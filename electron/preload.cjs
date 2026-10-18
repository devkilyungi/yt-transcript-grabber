// Lets the page know it's running inside the desktop app.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('desktop', { platform: process.platform });
