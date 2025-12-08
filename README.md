# Team Communication Hub

Team Communication Hub is an application built for web and iOS that allows for online and offline chat and group task collaboration features.

# Installation Guide

### Step #1

- Download the <code>.zip</code> file from this repository; unzip it and open in your code editor of choice.

### Step #2

- In the terminal of your code editor, navigate to the <code>client</code> folder by entering:
  <code>cd client</code>
- Now install all of the necessary dependencies for the client side of your application to function by entering the following command:
  <code>npm install</code>
- Wait for this process to complete, then navigate back to the project root by entering:
  <code>cd ..</code>

### Step #3

- Navigate to the server folder of the application by entering:
  <code>cd server</code>
- Now install all of the necessary dependencies for the server side of your application to function by entering the following command:
  <code>npm install</code>
- Wait for this process to complete, then navigate back to the project root by entering:
  <code>cd ..</code>

### Step #4

To launch your application, you will need to open <b>two</b> terminal windows.

- In the first, navigate to the server side by entering:
  <code>cd server</code>
- In order to start your server, you must enter the following command:
  <code>npm run dev</code>
- If your server starts successfully, congrats! You are halfway there!

In your <i>second</i> terminal window...

- Navigate to the client side by entering:
  <code>cd client</code>
- In order to start the client side of the application, you must enter the following command:
  <code>npx expo start</code>
- If successful, Expo will allow you to run the application from your browser (by pressing w in the terminal) or iOS device (either by scanning the QR code or by typing 'i' into your terminal)

You have now successfully launched Team Communication Hub!

# Advanced Feature Setup

For this assignment, we were required to implement one advanced feature into our application. I selected:

<code><b>Message reactions</b> with real-time updates</code>

These sources were used to help create this functionality:

- https://socket.io/docs/v4/emitting-events
- https://react.dev/learn/updating-arrays-in-state
- https://react.dev/learn/queueing-a-series-of-state-updates

## Technical Submission Checklist

- [x] App runs on web and iOS (tested locally) - Required

- [x] Server runs and handles multiple channels and simultaneous users

- [] Multi-channel real-time messaging works between multiple users

- [x] User presence and typing indicators function across channels

- [] One enhanced feature completed and functional - HALFWAY ATTEMPTED :/ 

- [] Offline message queuing works and syncs on reconnection

- [x] TypeScript used throughout (no JavaScript files)

- [x] README.md includes setup instructions for both client and server

- [x] Reflection completed (400-600 words)

- [x] Demo video shows multi-channel collaboration (2-3 minutes)

- [x] Screenshots included from web and iOS (Android if implemented)

- [x] No node_modules included in ZIP

- [x] GitHub repo is public and accessible

- [x] Code in ZIP matches GitHub repo
