import { WebSocketServer } from 'ws'
import Client from "./Client.js";
import RoomSettings from "./RoomSettings.js";
import express, { static as staticFile } from 'express';
import { join, dirname } from "path";
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

class Server {
    constructor(config) {
        this.expressApp = express();
        this.httpServer = this.expressApp.listen(config.port);
        this.wss = new WebSocketServer({
            backlog: 100,
            server : this.httpServer,
            maxPayload: 16384
        });
        this.expressApp.use(staticFile(join(__dirname, "../client/client")));

        this.connectionid = 0;
        this.connections = new Map();
        this.customListeners = new Map();
        this.roomlisteners = new Map();
        this.rooms = new Map();
        this.wss.on('connection', (ws, req) => {
            this.connections.set(++this.connectionid, new Client(ws, req, this));
        });
        this.legit_m = ["a", "bye", "hi", "ch", "+ls", "-ls", "m", "n", "devices", "t", "chset", "userset", "chown", "kickban",
            "admin message", "user_flag", "notification", // ADMIN MESSAGE IMPL
            "tag", "clearchat", "setcolor", "setname", "siteban", // Lapiss Managment
            "custom", "-custom", "+custom", "dm"
        ]
        this.welcome_motd = config.motd || "You agree to read this message.";
        this.salt = config.salt || "boppity";
        this.defaultUsername = config.defaultUsername || "Anonymous";
        this.defaultRoomSettings = new RoomSettings(config.defaultRoomSettings);
        this.defaultLobbySettings = new RoomSettings(config.defaultLobbySettings);

        this.defaultRoomColor = config.defaultRoomColor || "#3b5054";
        this.adminpass = config.adminpass || "Bop It";
    };
    updateRoom(data) {
        if (!data.ch.settings.visible) return;
        for (let client of Array.from(this.roomlisteners.values())) {
            client.sendArray([{
                "m": "ls",
                "c": false,
                "u": [data.ch]
            }])
        }
    }
}

export default Server;
