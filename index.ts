import { ServerWebSocket } from "bun";

// serve front
Bun.serve({
  port: 3000,
  fetch() {
    return new Response(Bun.file("./index.html"));
  },
});

// create another server for the websocket server
const messages: IMessage[] = [];
let users: string[] = [];

interface IMessage {
  text: string;
  username: string;
}

type WSData = {
  username: string;
};

Bun.serve({
  port: 4000,
  fetch(req, server) {
    // update request to a websocket
    const success = server.upgrade(req, {
      data: { username: "user_" + Math.random().toString(16).slice(12) },
    });

    return success
      ? undefined
      : new Response("Upgrade failed :(", { status: 500 });
  },
  websocket: {
    open(ws: ServerWebSocket<WSData>) {
      // store username
      users.push(ws.data.username);

      // subscribe to a channel
      ws.subscribe("chat");

      // Broadcast that a user joined
      ws.publish(
        "chat",
        JSON.stringify({ type: "USER_ADD", data: ws.data.username })
      );

      // update newly connected client with messages_set and users_set
      ws.send(JSON.stringify({ type: "USERS_SET", data: users }));
      ws.send(JSON.stringify({ type: "MESSAGES_SET", data: messages }));
    },
    message(ws, data) {
      // data is a string parse to object
      const message: IMessage = JSON.parse(data.toString());
      message.username = ws.data.username;
      messages.push(message);

      // send message to all clients
      ws.publish(
        "chat",
        JSON.stringify({ type: "MESSAGES_ADD", data: message })
      );
    },
    close(ws) {
        // update users
      users = users.filter((username) => username !== ws.data.username);

      // Send user left notif
      ws.publish(
        "chat",
        JSON.stringify({ type: "USERS_REMOVE", data: ws.data.username })
      );
    },
  },
});
