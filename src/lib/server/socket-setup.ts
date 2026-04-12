import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';

type Addr = string | { address: string; port: number };

type UserRecord = {
	id: number;
	socketId: string;
	address: string;
	color: string;
	name: string;
	connected: boolean;
};

let ioSingleton: Server | null = null;

export function setupSocketIOServer(httpServer: HttpServer | null | undefined): void {
	if (!httpServer || ioSingleton) return;

	const io = new Server(httpServer, {
		path: '/socket.io/',
		cors: { origin: true }
	});
	ioSingleton = io;

	const colorRangeOffset = Math.random() * 360;
	let lastUserId = 0;
	const allUsers: UserRecord[] = [];

	function getUserBySocketId(socketId: string | undefined): UserRecord | undefined {
		if (!socketId) return undefined;
		return allUsers.find((u) => u.socketId === socketId);
	}

	function emitUserListing() {
		const listing = allUsers.map((u) => ({
			socketId: u.socketId,
			color: u.color,
			name: u.name,
			connected: u.connected
		}));
		io.emit('user_listing', listing);
	}

	io.on('connection', (socket) => {
		const raw = socket.handshake.address as Addr;
		const sockAddr = typeof raw === 'string' ? raw : `${raw.address}:${raw.port}`;
		console.log(`[bge] connection ${socket.id} from ${sockAddr}`);

		socket.on('disconnect', () => {
			const user = getUserBySocketId(socket.id);
			if (user) user.connected = false;
			emitUserListing();
		});

		socket.on(
			'user_init',
			(data: { socketId?: string; previousSocketId?: string; name: string }) => {
				let user = getUserBySocketId(data.previousSocketId);
				if (!user) {
					user = {
						id: lastUserId++,
						socketId: socket.id,
						address: sockAddr,
						color: `hsla(${allUsers.length * 222.49223595 + colorRangeOffset}, 70%, 60%, 1)`,
						name: data.name ?? 'Guest',
						connected: true
					};
					allUsers.push(user);
				} else {
					user.socketId = socket.id;
					user.address = sockAddr;
					user.name = data.name ?? user.name;
					user.connected = true;
				}
				emitUserListing();
			}
		);

		socket.on('piece_move', (data: { id: number; x: number; y: number }) => {
			socket.broadcast.emit('piece_move', { id: data.id, x: data.x, y: data.y });
		});

		socket.on('piece_select', (data: { oursocketid: string; id: number }) => {
			const u = getUserBySocketId(data.oursocketid);
			socket.broadcast.emit('piece_select', {
				id: data.id,
				color: u?.color ?? '#888'
			});
		});

		socket.on('piece_deselect', (data: { id: number }) => {
			socket.broadcast.emit('piece_deselect', { id: data.id });
		});

		socket.on('piece_flip', (data: { id: number; isFlipped: boolean }) => {
			socket.broadcast.emit('piece_flip', {
				id: data.id,
				isFlipped: data.isFlipped
			});
		});

		socket.on(
			'piece_shuffle',
			(data: { id: number; zindex: number; x: number; y: number }) => {
				socket.broadcast.emit('piece_shuffle', {
					id: data.id,
					zindex: data.zindex,
					x: data.x,
					y: data.y
				});
			}
		);

		socket.on('piece_zindexchange', (data: { id: number; zindex: number }) => {
			socket.broadcast.emit('piece_zindexchange', {
				id: data.id,
				zindex: data.zindex
			});
		});

		socket.on('window_open', (data: { winid: string }) => {
			socket.broadcast.emit('window_open', { winid: data.winid });
		});

		socket.on(
			'window_roller_roll',
			(data: { rollId: string; result: string | number; datestr: string }) => {
				socket.broadcast.emit('window_roller_roll', {
					rollId: data.rollId,
					result: data.result,
					datestr: data.datestr
				});
			}
		);

		socket.on('textregion_change', (data: { winid: string; val: string }) => {
			socket.broadcast.emit('textregion_change', {
				winid: data.winid,
				val: data.val
			});
		});
	});
}
