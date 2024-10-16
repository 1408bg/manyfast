import { createRequire } from "module";
import path from "path";
const require = createRequire(import.meta.url);
const __dirname = path.resolve();

const generateRandomString = (num) => {
  const characters ='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  const charactersLength = characters.length;
  for (let i = 0; i < num; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
}

const KEY = generateRandomString(4);

const hash = (number) => {
  const value = String.fromCharCode(number+65);
  const temp = Buffer.from(`${value}${KEY}`).toString('base64');
  return `${KEY}${temp}`;
}

const unhash = (hashedString) => {
  const keyLength = KEY.toString().length;
  const encoded = hashedString.slice(keyLength);
  const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
  const originalNumber = decoded.slice(0, - keyLength).charCodeAt(0)-65;
  return originalNumber;
}

const getIPAddress = () => {
  return 'https://manyfast.ijw.app/';
}

const express = require("express");
const cookieParser = require('cookie-parser');
const socket = require('socket.io');

const shareLinks = {};
let linkCount = 0;

const app = express();

app.use(cookieParser());
app.use(express.json());

app.get("/", (req, res) => {
  res.clearCookie("id");
  res.sendFile(__dirname + "/router.html");
});

app.get("/assets/:path", (req, res) => {
  const path = req.params.path;
  res.sendFile(__dirname + "/assets/" + path);
});

app.get("/client/check/:id", (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 0 || id > clients.length) {
    return res.json({ error: "Invalid client ID" });
  }
  const client = clients[id-1];
  if (!client) {
    return res.json({error: "undefined client"});
  }
  const hasPassword = client.password && client.password.length > 0;
  res.json({ hasPassword });
});

app.get("/client/:id", (req, res) => {
  let id = parseInt(req.params.id);
  const type = req.cookies.type;
  const password = req.cookies.password;
  if (isNaN(id) || id < 0 || id > clients.length) { return res.send("Invalid client ID"); }
  if (!type) { return res.send("Invalid type"); }
  const client = clients[id-1];
  if (client.password && client.password.length > 0) {
    if (!password || password !== client.password) {
      return res.send(`<h1>Wrong password</h1><button onclick="window.location='/'">back</button>`);
    }
  }
  res.clearCookie("type");
  res.clearCookie("password");
  res.cookie("id", id);
  res.sendFile(__dirname + `/client/client-${type}.html`);
});

app.get("/join/:key", (req, res) => {
  const key = req.params.key;
  const value = shareLinks[unhash(key)];
  if (!value){ return res.send("invaild link"); }
  res.cookie("type", value.type);
  res.cookie("password", value.password);
  res.redirect(`/client/${value.id}`);
});

app.post("/share/:id", (req, res) => {
  const id = req.params.id;
  const type = req.body.type;
  const tmp = linkCount;
  if (isNaN(id) || !type){ return res.send("invaild request"); }
  const link = `${getIPAddress()}/join/${hash(tmp)}`;
  shareLinks[tmp] = {
    id: id,
    type: type,
    password: clients[id-1].password
  };
  setTimeout(() => {
    delete shareLinks[tmp];
  }, 1000*60);
  linkCount = (linkCount + 1)%52;
  res.send(link);
});

const server = app.listen(8000, () => {
  console.log("manyfast on 8000");
});

const io = socket(server, { path: '/socket.io' });

const clients = [
  {
    title: "Sample (Web)",
    description: "Web template (html, css, js)",
    type: "web",
    thumbnail: "web.jpg",
    password: ""
  },
  {
    title: "Sample (Node)",
    description: "Node.js template (only js)",
    type: "node",
    thumbnail: "node.jpg",
    password: ""
  },
  {
    title: "Sample (Sheet)",
    description: "Music sheet templete (just write)",
    type: "sheet",
    thumbnail: "sheet.jpg",
    password: ""
  }
];

const webData = {};
const nodeData = {};
const sheetData = {};

io.on("connection", (ws) => {
  const temp = ws.request.connection.remoteAddress.split(".");
  const clientIp = temp[temp.length-1];
  ws.emit("clients", clients);
  ws.on("add", (data) => {
    clients.push(data);
    setTimeout(() => {
      clients.pop(data);
    }, 1000 * 60 * 60);
    io.emit("add", data);
  });
  ws.on("html", (data) => { const temp = data.split("^", 2); ws.broadcast.emit(`html${temp[0]}`, temp[1]); });
  ws.on("css", (data) => { const temp = data.split("^", 2); ws.broadcast.emit(`css${temp[0]}`, temp[1]); });
  ws.on("js", (data) => { const temp = data.split("^", 2); ws.broadcast.emit(`js${temp[0]}`, temp[1]); });
  ws.on("node", (data) => { const temp = data.split("^", 2); ws.broadcast.emit(`node${temp[0]}`, temp[1]); });
  ws.on("sheet-left", (data) => { const temp = data.split("^", 2); ws.broadcast.emit(`sheet-left${temp[0]}`, temp[1]) });
  ws.on("sheet-right", (data) => { const temp = data.split("^", 2); ws.broadcast.emit(`sheet-right${temp[0]}`, temp[1]) });
  ws.on("save-web", (data) => {
    webData[data["id"]] = {
      "html" : data["html"],
      "css" : data["css"],
      "js" : data["js"]
    };
  });
  ws.on("save-node", (data) => {
    nodeData[data["id"]] = {
      "data" : data["code"]
    };
  });
  ws.on("save-sheet", (data) => {
    sheetData[data["id"]] = {
      "left" : data["left"],
      "right" : data["right"]
    };
  });
  ws.on("load-web", (data) => {
    const id = data["id"];
    if (webData[id] == undefined) { return; }
    ws.emit(`html${id}`, webData[id]["html"]);
    ws.emit(`css${id}`, webData[id]["css"]);
    ws.emit(`js${id}`, webData[id]["js"]);
  });
  ws.on("load-node", (data) => {
    const id = data["id"];
    if (nodeData[id] == undefined) { return; }
    ws.emit(`node${id}`, nodeData[id]["data"]);
  });
  ws.on("load-sheet", (data) => {
    const id = data["id"];
    if (sheetData[id] == undefined) { return; }
    ws.emit(`sheet-left${id}`, sheetData[id]["left"]);
    ws.emit(`sheet-right${id}`, sheetData[id]["right"]);
  });
});