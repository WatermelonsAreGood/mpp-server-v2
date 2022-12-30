const { EventEmitter } = require("node:events")
const WebSocket = require("ws")

const Client = require("./Client.js");
const RoomSettings = require("./RoomSettings.js");

class Server extends EventEmitter {
    constructor(config) {
        super();
        EventEmitter.call(this);
        this.wss = new WebSocket.Server({
            port: config.port,
            backlog: 100
        });
        this.connectionid = 0;
        this.connections = new Map();
        this.roomlisteners = new Map();
        this.rooms = new Map();
        this.wss.on('connection', (ws, req) => {
            this.connections.set(++this.connectionid, new Client(ws, req, this));
        });
        this.legit_m = ["a", "bye", "hi", "ch", "+ls", "-ls", "m", "n", "devices", "t", "chset", "userset", "chown", "kickban",
            "admin message", "user_flag", "notification", // ADMIN MESSAGE IMPL
            "tag", "clearchat", "setcolor", "setname", "siteban" // Lapiss Managment
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

module.exports = Server;
