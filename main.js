let vueApp = new Vue({
    el: "#vueApp",
    data: {
        // ros connection
        ros: null,
        rosbridge_address: 'wss://i-05300da67429cbbdb.robotigniteacademy.com/d5ed44b8-dfe5-45cb-9d8e-8ac3a6de8b21/rosbridge/',
        connected: false,
        // page content
        menu_title: 'Connection',
        // dragging data
        dragging: false,
        x: 'no',
        y: 'no',
        dragCircleStyle: {
            margin: '0px',
            top: '0px',
            left: '0px',
            display: 'none',
            width: '50px',
            height: '50px',
        },
        // joystick values
        joystick: {
            vertical: 0,
            horizontal: 0,
        },
        // publisher
        pubInterval: null,
        // subscriber data
        position: { x: 0, y: 0, z: 0, },
        orientation: {r: 0, p: 0, y: 0,},
        // map 
        mapViewer: null,
        mapGridClient: null,
        interval: null,
        // 3D Model
        viewer: null,
        tfClient: null,
        urdfClient: null,
        // waypoint navigation
        navigating: false, // true: robot is already going to a goal

    },
    methods: {
        connect: function() {
            // define ROSBridge connection object
            this.ros = new ROSLIB.Ros({
                url: this.rosbridge_address,
                groovyCompatibility: false //! IMPORTANT: Cannot visualize the robot without it!
            })

            // define callbacks
            this.ros.on('connection', () => {
                this.connected = true
                console.log('Connection to ROSBridge established!')
                // Init the velocity publisher
                this.pubInterval = setInterval(this.sendCommand, 100)
                // Camera setup
                this.setCamera()
                
                // Odom subscriber
                let topic = new ROSLIB.Topic({
                    ros: this.ros,
                    name: '/fastbot_1/odom',
                    messageType: 'nav_msgs/Odometry'
                })
                topic.subscribe((message) => {
                    this.position = message.pose.pose.position

                    // Compute RPY angles 
                    let orientation_q = message.pose.pose.orientation;

                    // Convert quaternion to Euler angles
                    let quaternion = new THREE.Quaternion(
                        orientation_q.x,
                        orientation_q.y,
                        orientation_q.z,
                        orientation_q.w
                    );

                    let euler = new THREE.Euler();
                    euler.setFromQuaternion(quaternion, 'ZYX'); // Yaw-Pitch-Roll order

                    // Save roll, pitch, yaw in radians
                    this.orientation = {
                        r: euler.x,
                        p: euler.y,
                        y: euler.z
                    };

                    //console.log(message)
                })

                // Map setup
                this.mapViewer = new ROS2D.Viewer({
                    divID: 'map',
                    width: 420,
                    height: 360
                })

                // Setup the map client.
                this.mapGridClient = new ROS2D.OccupancyGridClient({
                    ros: this.ros,
                    rootObject: this.mapViewer.scene,
                    continuous: true,
                })
                // Scale the canvas to fit to the map
                this.mapGridClient.on('change', () => {
                    this.mapViewer.scaleToDimensions(this.mapGridClient.currentGrid.width, this.mapGridClient.currentGrid.height);
                    this.mapViewer.shift(this.mapGridClient.currentGrid.pose.position.x, this.mapGridClient.currentGrid.pose.position.y)
                })

                // Setup 3D Viewer
                this.setup3DViewer()

            })
            this.ros.on('error', (error) => {
                console.log('Something went wrong when trying to connect')
                console.log(error)
            })
            this.ros.on('close', () => {
                this.connected = false
                document.getElementById('divCamera').innerHTML = ''
                document.getElementById('map').innerHTML = ''
                this.unset3DViewer()
                console.log('Connection to ROSBridge was closed!')
            })
        },
        disconnect: function() {
            this.ros.close()
        },
        sendCommand: function() {
            let topic = new ROSLIB.Topic({
                ros: this.ros,
                name: '/fastbot_1/cmd_vel',
                messageType: 'geometry_msgs/Twist'
            })
            let message = new ROSLIB.Message({
                linear: { x: this.joystick.vertical, y: 0, z: 0, },
                angular: { x: 0, y: 0, z: this.joystick.horizontal, },
            })
            topic.publish(message)
        },
        startDrag() {
            this.dragging = true
            this.x = this.y = 0
        },
        stopDrag() {
            this.dragging = false
            this.x = this.y = 'no'
            this.dragCircleStyle.display = 'none'
            this.resetJoystickVals()
        },
        doDrag(event) {
            if (this.dragging) {
                this.x = event.offsetX
                this.y = event.offsetY
                let ref = document.getElementById('dragstartzone')
                this.dragCircleStyle.display = 'inline-block'

                let minTop = ref.offsetTop - parseInt(this.dragCircleStyle.height) / 2
                let maxTop = minTop + 150
                let top = this.y + minTop
                this.dragCircleStyle.top = `${top}px`

                let minLeft = ref.offsetLeft - parseInt(this.dragCircleStyle.width) / 2
                let maxLeft = minLeft + 150
                let left = this.x + minLeft
                this.dragCircleStyle.left = `${left}px`

                this.setJoystickVals()
                
            }
        },
        setJoystickVals() {
            this.joystick.vertical = -1 * ((this.y / 150) - 0.5)
            this.joystick.horizontal = +1 * ((this.x / 150) - 0.5)
        },
        resetJoystickVals() {
            this.joystick.vertical = 0
            this.joystick.horizontal = 0
        },
        setCamera: function() {
            let without_wss = this.rosbridge_address.split('wss://')[1]
            console.log(without_wss)
            let domain = without_wss.split('/')[0] + '/' + without_wss.split('/')[1]
            console.log(domain)
            let host = domain 
            //let host = domain + '/cameras'
            let viewer = new MJPEGCANVAS.Viewer({
                divID: 'divCamera',
                host: host,
                width: 320,
                height: 240,
                topic: '/fastbot_1/camera/image_raw',
                ssl: true,
            })
        },
        sendCommand: function() {
            let topic = new ROSLIB.Topic({
                ros: this.ros,
                name: '/fastbot_1/cmd_vel',
                messageType: 'geometry_msgs/Twist'
            })
            let message = new ROSLIB.Message({
                linear: { x: this.joystick.vertical, y: 0, z: 0, },
                angular: { x: 0, y: 0, z: this.joystick.horizontal, },
            })
            topic.publish(message)
        },
        setup3DViewer() {
            this.viewer = new ROS3D.Viewer({
                background: '#cccccc',
                divID: 'div3DViewer',
                width: 350,
                height: 300,
                antialias: true,
                fixedFrame: 'map'
            })

            // Add a grid.
            this.viewer.addObject(new ROS3D.Grid({
                color:'#0181c4',
                cellSize: 0.5,
                num_cells: 20
            }))

            // Setup a client to listen to TFs.
            this.tfClient = new ROSLIB.TFClient({
                ros: this.ros,
                angularThres: 0.01,
                transThres: 0.01,
                rate: 10.0,
                fixedFrame: 'map'
            })

            // Setup the URDF client.
            this.urdfClient = new ROS3D.UrdfClient({
                ros: this.ros,
                param: '/fastbot_1_robot_state_publisher:robot_description',
                tfClient: this.tfClient,
                // We use "path: location.origin + location.pathname"
                // instead of "path: window.location.href" to remove query params,
                // otherwise the assets fail to load
                path: location.origin + location.pathname,
                rootObject: this.viewer.scene,
                loader: ROS3D.COLLADA_LOADER_2
            })
        },
        unset3DViewer() {
            document.getElementById('div3DViewer').innerHTML = ''
        },
        // Go to the waypoint 
        sendNavGoal(waypointName) {
            var poseDict = {
                'Sofa': {
                    position: { x: -2.695, y: 1.118, z: 0.0 },
                    orientation: { x: 0.0, y: 0.0, z: 0.0, w: 1.0 },
                },
                'Kitchen': {
                    position: { x: -0.738, y: -1.294, z: 0.0 },
                    orientation: { x: 0.0, y: 0.0, z: 0.0, w: 1.0 },
                },
                'Living-room': {
                    position: { x: 2.177, y: 1.386, z: 0.0 },
                    orientation: { x: 0.0, y: 0.0, z: 0.0, w: 1.0 },
                },
            };

            var pose = poseDict[waypointName];
            if (!pose) {
                console.error('Unknown waypoint:', waypointName);
                return;
            }

            var actionClient = new ROSLIB.ActionClient({
                ros: this.ros,
                serverName: '/navigate_to_pose',
                actionName: 'nav2_msgs/action/NavigateToPose',
            });

            var goal = new ROSLIB.Goal({
                actionClient: actionClient,
                goalMessage: {
                    pose: {
                        header: {
                            frame_id: 'map',
                            // stamp: { sec: 0, nanosec: 0 },
                        },
                        pose: pose,
                    },
                    behavior_tree: '', 
                },
            });

            // The robot started going towards the goal
            this.navigating = true;

            goal.on('feedback', (feedback) => {
                console.log('[Nav2] Feedback:', feedback);
            });

            goal.on('result', (result) => {
                this.navigating = false;
                console.log('[Nav2] Goal Result:', result);
                // alert(`Arrived at ${waypointName}`);
                this.navigating = false;
                
            });

            // goal.on('timeout', () => {
            //     console.warn('Navigation goal timed out');
            //     this.navigating = false;
            // });

            goal.send();
            console.log(`[Nav2] Goal sent to: ${waypointName}`);
        }


    },
    mounted() {
        // page is ready
        window.addEventListener('mouseup', this.stopDrag)
        // Set the communicatio interval to keep connection alive
        this.interval = setInterval(() => {
            if (this.ros != null && this.ros.isConnected) {
                this.ros.getNodes((data) => { }, (error) => { })
            }
        }, 10000)
    },
})