const UDP_PORT = 18902;
const SERVER_PORT = 8912;
const CON_STATUS = {
    "DISCONNECTED": 0,
    "CONNECTING": 1,
    "CONNECTED": 2
};
const contentFolder = app.GetPrivateFolder();

let net, server, wsClient;
let isServer = false;
let serverAddress = null;
let connectionStatus = 0;
let verificationCode = null;
let tmp = {
    "serverDiscoveryTimeout": null,
    "serverAddress": null
};

function OnStart() {
    app.SetDebug("console");
	if (app.GetBuildNum() > 25) app.SetInForeground("Wi-Fi Quick Chat");
	
	net = app.CreateNetClient("UDP");
	
	setInterval(checkUDPMessage, 500);
	
	sendUDP({"type": "DiscoverServer"});
	serverDiscoveryTimeout = setTimeout(createServer, 3000); // Maybe make this longer?
}

function OnMessage(data) {
    if (typeof data != "object") data = JSON.parse(data);
    console.log("From Main: " + data.type);

    switch(data.type) {
        case "AreYouAlive":
            sendMsg("Connected");
            break;

        case "SendMessage":
            // TODO: Fix main app still showing "No Messages Yet"
            if (!server) {
                tmp.isSendingMessage = true;
                tmp.messageFailedTimeout = setTimeout(() => {
                    tmp.isSendingMessage = false;
                    sendMsg("MessageSentFailed");
                });
                sendWs("Message", {"message": {
                    "author": app.GetIPAddress(),
                    "content": data.message
                }});
                return;
            }
            server.SendText({
                "type": "Message",
                "from": app.GetIPAddress(),
                "message": {
                    "author": app.GetIPAddress(),
                    "content": data.message
                }
            });
            sendMsg("MessageSent");
            break;
    }
}

function sendUDP(data) {
    console.log("Sending UDP: " + data.type);
    net.SendDatagram(JSON.stringify(data), "UTF-8", net.GetBroadcastAddress(), UDP_PORT);
}

function sendWs(type, data) {
    console.log("Sending WS: " + type);
    let toSend = {
        type,
        from: app.GetIPAddress()
    };
    for(let k in data) toSend[k] = data[k];
    wsClient.send(toSend);
}

function connectToServer(serverAddr) {
    if (serverAddr.split('.').length != 4) return;
    
    tmp.serverAddress = serverAddr;
    
    wsClient = app.CreateWebSocket(serverAddr, "sock1", 3);
    wsClient.SetOnClose(resetConnection);
    wsClient.SetOnOpen(() => {
        verificationCode = Math.floor(Math.random() * 999);
        console.log("WS Opened, Verifying Connection... With code: " + verificationCode);
        app.HttpRequest("GET", "http://" + serverAddress + ':' + SERVER_PORT, "/verify", "call=" + app.GetIPAddress() + "|code=" + verificationCode, (err, rep) => {
            if (err) resetConnection();
        });
    });
    wsClient.SetOnMessage(onWsReceive);
}

function resetConnection() {
    try {
        wsClient.Close();
    } catch(e) {}
    connectionStatus = 0;
    serverAddress = null;
    verificationCode = null;
}

function createServer() {
    // Better to use NodeJS for more features.
    console.log("Creating Server instead...");
    server = app.CreateWebServer(SERVER_PORT, "Reflect");
    server.Start();
    serverAddress = app.GetIPAddress();
    connectionStatus = CON_STATUS.CONNECTED;
    sendUDP({"type": "BroadcastServer", "address": serverAddress});
    sendMsg("Connected");
}

function sendMsg(type, data = {}) {
    console.log("Sending to app: " + type);
    app.SendMessage(JSON.stringify({"type": type, ...data}));
}

function checkUDPMessage() {
    console.log("Receivng Datagram...");
    const packet = net.ReceiveDatagram("UTF-8", net.GetBroadcastAddress(), UDP_PORT);
    if (!packet) return;
    
    let data = {};
    
    try {
	    let parsedData = JSON.parse(packet);
	    data = parsedData;
	} catch(e) {
	    console.log(e);
	    console.log(packet);
	    return;
	}
	
	switch(data.type) {
	    case "DiscoverServer":
	        if (connectionStatus == CON_STATUS.CONNECTED) sendUDP({"type": "BroadcastServer", "address": serverAddress});
	        break;
	   case "BroadcastServer":
	        if (connectionStatus != CON_STATUS.CONNECTING || connectionStatus != CON_STATUS.CONNECTED || !data.address) return;
	        
	        clearTimeout(serverDiscoveryTimeout);
	        connectToServer(data.address);
	        break;
	}
}

function onWsReceive(msg) {
    if (verificationCode !== null)
        if (verificationCode != msg) resetConnection();
        else {
            // TODO: Add special server key
            clearTimeout(serverDiscoveryTimeout);
            serverAddress = tmp.serverAddress;
            connectionState = CON_STATUS.CONNECTED;
            verificationCode = null;
            sendMsg("Connected");
        }
    
    let data = {};
    
    try {
        data = JSON.parse(msg);
    } catch(e) {
        return;
    }

    if (data.from == app.GetIPAddress()) {
        if (data.type != "Message") return;
        if (data.message.author == app.GetIPAddress()) return sendMsg("MessageSent");
    };
    
    const verifyMessage = (message) => {
        if (typeof message != "object") return false;
        if (!message.author || !message.content) return false;
        
        return true;
    };

    switch(data.type) {
        case "Message":
            if (!verifyMessage(data.message)) return;
            sendMsg("Message", data.message);
            // TODO: Save messages to a file and delete that file every time
            break;
        default:
            console.log("Unknown", msg);
    }
}