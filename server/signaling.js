import { Server } from 'socket.io';  // Use ES Modules import

export function initializeSignalingServer(server) {  // Use named export
    const io = new Server(server, {  // `socketIo` → `new Server()`
        cors: {
            origin: true,
            methods: ["GET", "POST"],
            credentials: true
        }
    });
    
    // Log the CORS configuration
    console.log('WebRTC signaling server initialized with dynamic CORS support');


    const rooms = new Map(); // Map to store room information: { clients: Set, callStarted: boolean }

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        socket.on('join', ({ room, isTherapist }) => {
            console.log(`Client ${socket.id} joining room ${room} as ${isTherapist ? 'therapist' : 'patient'}`);
            
            // Get or create room
            if (!rooms.has(room)) {
                rooms.set(room, { 
                    clients: new Map(), // Changed to Map to store client role information
                    callStarted: false 
                });
            }
            const roomInfo = rooms.get(room);

            // Check room capacity
            if (roomInfo.clients.size >= 2) {
                socket.emit('room-full');
                return;
            }

            // Prevent duplicate connections from same socket
            if (roomInfo.clients.has(socket.id) || socket.rooms.has(room)) {
                console.log(`Blocking duplicate connection from socket: ${socket.id}`);
                socket.emit('error', { message: 'You are already connected to this session' });
                return;
            }

            // Check if client is already in the room with a different socket ID
            let clientIpAddress = socket.handshake.address;
            let duplicateConnection = false;
            let existingRole = null;
            let roleAlreadyExists = false;

            // Log connection information
            console.log(`Client connecting from IP: ${clientIpAddress}, Socket ID: ${socket.id}`);

            // Check for existing connections with same role
            roomInfo.clients.forEach((clientInfo) => {
                // Block duplicate roles
                if (clientInfo.role === (isTherapist ? 'therapist' : 'patient')) {
                    roleAlreadyExists = true;
                }
            });

            if (roleAlreadyExists) {
                socket.emit('error', { message: 'Role already exists in this room' });
                console.log(`Blocking duplicate ${isTherapist ? 'therapist' : 'patient'} connection in room ${room}`);
                return;
            }

            // Check for existing connections from same IP but with different role
            roomInfo.clients.forEach((clientInfo, clientId) => {
                if (socket.handshake.address === clientInfo.ipAddress && 
                    clientInfo.role !== (isTherapist ? 'therapist' : 'patient')) {
                    existingRole = clientInfo.role;
                }
            });

            // Join the room
            socket.join(room);
            
            // Store client info with role and IP address
            roomInfo.clients.set(socket.id, {
                role: isTherapist ? 'therapist' : 'patient',
                ipAddress: clientIpAddress,
                joinTime: Date.now()
            });

            // Notify client about successful join
            socket.emit('joined', {
                room,
                numClients: roomInfo.clients.size,
                callStarted: roomInfo.callStarted,
                clientId: socket.id
            });

            // Notify other clients in the room
            socket.to(room).emit('user-connected', { 
                socketId: socket.id,
                role: isTherapist ? 'therapist' : 'patient'
            });
            
            // Log room state after join
            console.log(`Room ${room} now has ${roomInfo.clients.size} clients`);
            let clientsInfo = [];
            roomInfo.clients.forEach((info, id) => {
                clientsInfo.push(`${id} (${info.role})`);
            });
            console.log(`Clients in room ${room}: ${clientsInfo.join(', ')}`);
        });

        // Handle call start from therapist
        socket.on('start-call', ({ room, startTime }) => {
            if (rooms.has(room)) {
                const roomInfo = rooms.get(room);
                roomInfo.callStarted = true;
                roomInfo.startTime = startTime || Date.now();
                // Notify all clients in the room that the call has started with timestamp
                io.to(room).emit('call-started', { startTime: roomInfo.startTime });
            }
        });

        // Handle WebRTC signaling with improved error handling
        socket.on('offer', ({ room, offer }) => {
            try {
                console.log(`Offer received in room ${room}`);
                socket.to(room).emit('offer', offer);
            } catch (error) {
                console.error('Error handling offer:', error);
                socket.emit('error', { message: 'Failed to process offer' });
            }
        });

        socket.on('answer', ({ room, answer }) => {
            try {
                console.log(`Answer received in room ${room}`);
                socket.to(room).emit('answer', answer);
            } catch (error) {
                console.error('Error handling answer:', error);
                socket.emit('error', { message: 'Failed to process answer' });
            }
        });

        socket.on('ice-candidate', ({ room, candidate }) => {
            try {
                console.log(`ICE candidate received in room ${room}`);
                socket.to(room).emit('ice-candidate', candidate);
            } catch (error) {
                console.error('Error handling ICE candidate:', error);
                socket.emit('error', { message: 'Failed to process ICE candidate' });
            }
        });

        // Handle media state changes (audio/video mute/unmute)
        socket.on('media-state-change', ({ room, type, enabled }) => {
            try {
                console.log(`Media state change in room ${room}: ${type} ${enabled ? 'enabled' : 'disabled'}`);
                socket.to(room).emit('media-state-change', { type, enabled });
            } catch (error) {
                console.error('Error handling media state change:', error);
                socket.emit('error', { message: 'Failed to process media state change' });
            }
        });

        // Handle disconnection with cleanup
        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
            
            // Remove client from all rooms
            rooms.forEach((roomInfo, roomId) => {
                if (roomInfo.clients.has(socket.id)) {
                    roomInfo.clients.delete(socket.id);
                    if (roomInfo.clients.size === 0) {
                        rooms.delete(roomId);
                    } else {
                        // Notify remaining clients
                        socket.to(roomId).emit('user-disconnected', { socketId: socket.id });
                    }
                }
            });
        });

        // Handle errors
        socket.on('error', (error) => {
            console.error('Socket error:', error);
        });
    });

    return io;
}