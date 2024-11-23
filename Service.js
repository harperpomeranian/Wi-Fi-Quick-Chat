cfg.Fast;
const UDP_PORT = 18902;
const SERVER_PORT = 8912;
const PSWD = "amazing.";
const CON_STATUS = {
    "DISCONNECTED": 0,
    "CONNECTING": 1,
    "CONNECTED": 2
};
const contentFolder = app.GetPrivateFolder();

let net, crypt, server, wsClient;
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
	crypt = app.CreateCrypt();
	
	setInterval(checkUDPMessage, 500);
	
	sendUDP({"type": "DiscoverServer"});
	serverDiscoveryTimeout = setTimeout(createServer, 5000);
}

function OnMessage(data) {
    data = JSON.parse(data);
    switch(data.type) {
        case "SendMessage":
            // TODO: Send the message via Websocket
            break;
    }
}

function sendUDP(data) {
    console.log("Sending UDP: " + data.type);
    net.SendDatagram(btoa(crypt.Encrypt(JSON.stringify(data), PSWD)), "UTF-8", net.GetBroadcastAddress(), UDP_PORT);
}

function checkUDPMessage() {
    const packet = net.ReceiveDatagram("UTF-8", net.GetBroadcastAddress(), UDP_PORT);
    if (!packet) return;
    
    let data = {};
    
    try {
	    let parsedData = JSON.parse(crypt.Decrypt(atob(packet), PSWD));
	    data = parsedData;
	} catch(e) {
	    console.log(e);
	    console.log(data);
	    console.log(packet);
	    console.log(atob(data));
	    return;
	}
	
	switch(data.type) {
	    case "DiscoverServer":
	        if (connectionStatus == CON_STATUS.CONNECTED) sendUDP({"type": "BroadcastServer", "address": serverAddress});
	        break;
	   case "BroadcastServer":
	        if (connectionStatus != CON_STATUS.CONNECTING || connectionStatus != CON_STATUS.CONNECTED || !data.address) return;
	        
	        clearTimeout(serverDiscoveryTimeout);
	        connectToSever(data.address);
	        break;
	}
}

function connectToServer(serverAddr) {
    if (serverIp.split('.').length != 4) return;
    
    tmp.serverAddress = serverAddr;
    
    wsClient = app.CreateWebSocket(serverAddr, "sock1", 3);
    wsClient.SetOnClose(resetConnection);
    wsClient.SetOnOpen(() => {
        verificationCode = Math.floor(Math.random() * 999);
        console.log("WS Opened, Verifying Connection... With code: " + verificationCode);
        app.HttpRequest("GET", "http://" + serverAddress + ':' + SERVER_PORT, "/verify", "call=" + app.GetIPAddress() + "|code=" + verificationCode, (err, rep) => {
            if (err) return resetConnection();
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

function broadcastMessage() {
}

function sendMsg(type, data = {}) {
    console.log("Sending to app: " + type);
    app.SendMessage(JSON.stringify({"type": type, ...data}));
}

function onWsReceive(msg) {
    if (verificationCode !== null)
        if (verificationCode != msg) resetConnection();
        else {
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
    
    switch(data.type) {
        case "Message":
            sendMsg("Message", data.message);
            break;
        default:
            console.log('Idk');
            console.log(msg);
    }
}