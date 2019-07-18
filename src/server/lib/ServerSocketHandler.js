const EventEmitter = require('events');
const socketIo = require('socket.io');

const SERVER_SOCKET_HANDLER_EVENTS = require('./constants/ServerSocketHandlerEvents');
const SERVER_SOCKET_MESSAGE = require('../../lib/constants/ServerSocketMessage');
const CLIENT_SOCKET_MESSAGE = require('../../lib/constants/ClientSocketMessage');
const CLIENT_ROLE = require('../../lib/constants/ClientRole');

/**
 * @class ServerSocketHandler
 *
 * @description
 * Controls the sending and receiving of information from and to the connected clients
 * over sockets
 */
class ServerSocketHandler extends EventEmitter
{
  /**
   * @constructor
   *
   * @param {Kernel} kernel
   */
  constructor(kernel) {
    super();

    this._kernel = kernel;
    this._connectedClients = 0;
    this._io = socketIo(kernel.http);

    this._bindEvents();
  }


  /**
   * @type {Kernel}
   */
  get kernel() { return this._kernel; }


  /**
   * @type {socketIo}
   */
  get io() { return this._io; }


  /**
   * @type {number}
   */
  get connectedClients() { return this._connectedClients; }


  /**
   * @type {object}
   */
  get serverState() { return this.kernel.serializeState(); }


  /**
   * @description
   * Bind the event listeners this class cares about
   */
  _bindEvents() {
    this.once(SERVER_SOCKET_HANDLER_EVENTS.INITIALISED, this._handleInitialised.bind(this));

    this.io.on('connection', this._handleSocketConnected.bind(this));
  }


  /**
   * @description
   * Fired when the Server Socket Handler is initialised
   */
  _handleInitialised() {
    console.log('Server Socket Handler Initialised.');
  }


  /**
   * @description
   * Fired when a client socket connection is established
   *
   * @param socket socket
   * @returns {void}
   */
  _handleSocketConnected(socket) {
    console.log('Socket Connected. Awaiting identification...');

    // Create a temporary handler for this socket until they identify who / what they are
    socket.on('disconnect', this._handleSocketDisconnected.bind(this));
    socket.once('ID', clientRole => this._handleSocketIdentityReceived(socket, clientRole));

    // Emit an identity request
    socket.emit('ID');

    // Setup a timeout to terminate the connection if we don't hear from them in 3 seconds.
    socket.identityTimeout = setTimeout(() => {
      console.log('Socket Identity not verified. Booting.');
      clearTimeout(socket.identityTimeout);
      socket.emit('MSG', 'No identity provided in the allotted time. Goodbye.');
      socket.disconnect();
    }, 3000);
  }


  /**
   * @description
   * Fired when an incoming socket attempts to identify itself.
   *
   * @param {CLIENT_ROLE} clientRole
   */
  _handleSocketIdentityReceived(socket, clientRole) {
    // Clear the identity timeout on the socket
    clearTimeout(socket.identityTimeout);

    // TODO: at some point in the future add some auth here

    // Ensure the role is valid
    if (!Object.values(CLIENT_ROLE).includes(clientRole)) {
      console.log(`Invalid client role "${clientRole}" provided. Booting.`);
      socket.emit('MSG', 'Invalid client role provided. Goodbye.');
      socket.disconnect();
    }

    console.log(`Socket Identified as "${clientRole}".`, { connectedClients: this.connectedClients });
    socket.clientRole = clientRole;

    // TODO: subscribe the socket to the appropriate rooms / channels

    // Keep track of the connected client
    this._connectedClients += 1;

    // If everything else checks out - setup the rest of the socket handler stuff
    socket.on('MSG', this._handleClientMessageReceived.bind(this));

    // Notify any listeners of this class that a client has connected
    this.emit(SERVER_SOCKET_HANDLER_EVENTS.CLIENT_CONNECTED, { socket, connectedClients: this.connectedClients });

    // Send an initial server state to the client
    setTimeout(() => {
      this.sendMessageToClients(SERVER_SOCKET_MESSAGE.INITIALISE, this.serverState, socket);
    }, 0);
  }


  /**
   * @description
   * Fired when a client socket is disconnected
   *
   * @returns {void}
   */
  _handleSocketDisconnected(...params) {
    this._connectedClients -= 1;

    console.log('Client disconnected', { ...params });

    // Notify any listeners of this class that a socket has disconnected
    this.emit(SERVER_SOCKET_HANDLER_EVENTS.CLIENT_DISCONNECTED, { connectedClients: this.connectedClients });
  }


  /**
   * @description
   * Fired when a message is received from a connected client
   *
   * @param {string} message
   * @param {object} payload
   * @returns {void}
   */
  _handleClientMessageReceived(message, payload) {
    switch (message) {
      case CLIENT_SOCKET_MESSAGE.TEST:
        console.log('Test Message received from the client loud and clear!');
        break;

      default:
        console.warn(`Unhandled client socket message: ${message}`, { payload });
        break;
    }

    this.emit(SERVER_SOCKET_HANDLER_EVENTS.CLIENT_MESSAGE_RECEIVED, { message, payload });
  }


  /**
   * @description
   * Initialise the Server Socket Handler
   */
  async initialise() {
    console.log('Server Socket Handler initialising...');

    // Let everyone know that the Socket Handler is initialised
    this.emit(SERVER_SOCKET_HANDLER_EVENTS.INITIALISED);
  }


  /**
   * @description
   * Send a message to a specific socket or to everyone
   *
   * @param {string} message
   * @param {object} payload
   * @param {object} [socket=undefined]
   */
  sendMessageToClients(message, payload, socket) {
    const self = this;
    if (typeof (socket) === 'undefined') {
      self.io.emit('MSG', message, payload);
    } else {
      socket.emit('MSG', message, payload);
    }
  }
}

module.exports = ServerSocketHandler;
