cfg.Fast, cfg.Dark, cfg.Portrait;

function OnStart() {
    app.SetDebug("console");
    app.PreventScreenLock(true);
    app.ShowProgress("Please wait...");
    
    lay = app.CreateLayout("Linear", "VCenter,FillXY");
    
    infoText = app.AddText(lay, app.GetIPAddress(), 1, 0.05, "Center");
    infoText.SetBackColor('#202020');
    
    scroller = app.AddScroller(lay, 1, 0.9);
    lay1 = app.CreateLayout("Linear");
    msgList = app.AddList(lay1, "No Messages Yet:Launch the app on another device and start chatting!:null", 1, null, "Expand");
    scroller.AddChild(lay1);
    
    layh1 = app.AddLayout(lay, "Linear", "Horizontal,Center");
    layh1.SetSize(1, .05)
    layh1.SetBackColor('#202020');
    messageBox = app.AddTextEdit(layh1, "", .8, .05, "SingleLine");
    messageBox.SetHint('Enter your cool message...');
    sendBtn = app.AddButton(layh1, 'Send');
    sendBtn.SetOnTouch(onSendMsg);
    app.AddLayout(lay);
    
    svc = app.CreateService("this", "this", () => app.ShowProgress("Connection Loading..."), "Persist");
    svc.SetOnMessage(onSvcMsg);
}

function OnResume() {
    infoText.SetHtml(app.GetIPAddress());
}

function onSvcMsg(data) {
    data = JSON.parse(data);
    
    switch(data.type) {
        case "Connected":
            app.HideProgress();
            break;
        case "LoadMessages":
            let messages = [];
            for(let msg in data.messages) messages.push(msg.author + ':' + msg.content.replace(/,/g, "^c^"));
            msgList.SetList(messages.join(','));
            break;
            
        case "MessageSent":
            app.HideProgress();
            msgList.InsertItem(msgList.GetList().length, app.GetIPAddress(), messageBox.GetText());
            messageBox.SetText("");
            break;
        case "MessageFailed":
            app.HideProgress();
            app.Alert("Couldn't send your message!", "Error");
            break;
    }
}

function onSendMsg() {
    if (!messageBox.GetText().trim()) return;
    
    app.ShowProgress("Sending Message...");
    sendMessage("SendMessage", {"message": messageBox.GetText()});
}

function sendMessage(type, data) {
    let toSend = { type };
    for(let k in data) toSend[k] = data[k];
    svc.SendMessage(JSON.stringify(toSend));
}