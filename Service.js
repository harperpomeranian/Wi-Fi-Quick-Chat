const UDP_PORT = 18902;
const SERVER_PORT = 8000 + Math.floor(Math.random() * 1000);
const contentFolder = app.GetPrivateFolder();
const GetIP = () => app.GetIPAddress() + ':' + SERVER_PORT;

let net, server;
let discoveredUsers = {};
let isPaused = true;

function OnStart() {
    app.SetDebug("console");
	if (app.GetBuildNum() > 25) app.SetInForeground("Wi-Fi Quick Chat");
	
	net = app.CreateNetClient("UDP");
    net.SetOnReceive(onUDPMessage);
    net.ReceiveDatagrams(UDP_PORT, "UTF-8");

    setInterval(() => {
        console.log(Object.keys(discoveredUsers));
        sendMsg("Active", {"num": Object.keys(discoveredUsers).length});
    }, 1000);

    createServer();
}

function OnMessage(data) {
    if (typeof data != "object") data = JSON.parse(data);
    console.log("From Main: " + data.type);

    switch(data.type) {
        case "AreYouReady?":
            isPaused = false;
            if (server) sendMsg("Ready");
            break;

        case "Paused":
            isPaused = true;
            break;
        case "Resumed":
            isPaused = false;
            break;

        case "SendMessage":
            // TODO: Fix main app still showing "No Messages Yet"
            broadcastData("Message", {
                "author": GetIP(),
                "content": data.message
            });
            sendMsg("MessageSent");
            break;
    }
}

function sendMsg(type, data = {}) {
    console.log("Sending to app: " + type);
    app.SendMessage(JSON.stringify({type, ...data}));
}

function broadcastUDP(data) {
    console.log("Broadcasting UDP Message: " + data.type);
    data.from = GetIP();
    net.SendDatagram(JSON.stringify(data), "UTF-8", net.GetBroadcastAddress(), UDP_PORT);
}

function broadcastData(type, data) {
    console.log("Sending to clients: " + type);
    let toSend = {
        type,
        from: GetIP()
    };
    for(let k in data) toSend[k] = data[k];

    for(let user in discoveredUsers) {
        // Yes, this will cause an error if the url length is more than ~2000 characters
        httpReq("GET", "http://" + user, "/message", "data=" + btoa(JSON.stringify(toSend)));
    }
}

function createServer() {
    // Better to use NodeJS for more features.
    console.log("Creating Server...");
    server = app.CreateWebServer(SERVER_PORT);
    server.AddServlet("/message", onServletMessage);
    server.AddServlet("/here", (data, _) => {
        try {
            data.ip = atob(data.ip);
            if (data.ip.split('.').length !== 4 || data.ip[data.ip.length - 5] !== ':') return;
        } catch(e) {
            return;
        }
        
        // Maybe make the hotspot device immortal?
        discoveredUsers[data.ip] = Date.now();
    })
    server.Start();

    console.log("Server created! " + GetIP());
    sendMsg("Ready");

    setInterval(() => {
        broadcastUDP({"type": "Here"});
        
        if (!app.IsWifiApEnabled()) return;

        for(let user in discoveredUsers) {
            httpReq("GET", "http://" + user, "/here", "ip=" + btoa(GetIP()));
        }
    }, 1000);
    setInterval(() => { // Remove dead uesrs
        for(let user in discoveredUsers) {
            let lastPing = Date.now() - discoveredUsers[user];

            if (lastPing > 5000) {
                console.log("Removing " + user + " because last ping was from " + (lastPing / 1000) + " seconds ago");
                delete discoveredUsers[user];
            }
        }
    }, 5000);
}

function onUDPMessage(packet, _) {
    if (!packet) return console.log("Invalid packet...");
    
    let data = {};
    
    try {
	    let parsedData = JSON.parse(packet);
	    data = parsedData;
	} catch(e) {
	    console.log(e);
	    console.log(packet);
	    return;
	}

    if (!data.from || data.from == GetIP()) return;
    // Checking if the IP is valid via pinging is better
    if (data.from.split('.').length != 4) return;
	
	switch(data.type) {
        case "Here":
            console.log("User " + data.from + " is alive");

            // Discovery work-around if the hotspot of this device is enabled
            if (!discoveredUsers[data.from]) httpReq("GET", "http://" + data.from, "/here", "ip=" + btoa(GetIP()));

            discoveredUsers[data.from] = Date.now();
            break;
	}
}

function onServletMessage(receivedData, _) {
    let message = {};
    
    try {
        message = JSON.parse(atob(receivedData.data));
    } catch(e) {
        return;
    }
    
    if (!message.author || !message.content) return false;
    
    if (isPaused) {
        const notif = app.CreateNotification("AutoCancel");
        notif.SetMessage("New Message!", message.author, message.content)
        notif.Notify(Date.now());
    }

    sendMsg("Message", message);
}

// Refactor this... it's horrible..
function httpReq(type, baseUrl, path, params, retries = 0) {
    const request = new Request(baseUrl + path + "?" + params, {
        "method": "GET"
    });

    fetch(request).catch(() => {
        retries++;
        if (retries > 3) return;

        setTimeout(httpReq(type, baseUrl, path, params, retries), 1000);
    });
}