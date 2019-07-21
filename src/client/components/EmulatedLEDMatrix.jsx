import React from 'react';

import clientSocketHandler from '../lib/ClientSocketHandler';
import int2rgb from '../../lib/helpers/int2rgb';

import SERVER_SOCKET_MESSAGE from '../../lib/constants/ServerSocketMessage';
import CLIENT_SOCKET_HANDLER_EVENTS from '../lib/constants/ClientSocketHandlerEvents';

/**
 * @class EmulatedLEDMatrix
 *
 * @description
 * Renders out an LED Matrix that looks just like the real thing
 *
 * @todo: Ensure we flush the matrix whenever the width and height of the device changes
 */
class EmulatedLEDMatrix extends React.Component {
  constructor(props) {
    super(props);

    // TODO: get these values from the server
    const width = 10;
    const height = 5;

    // Iterate over the rows
    const matrix = [];
    for (let y = 0; y < height; y += 1) {
      const row = [];
      // Iterate over the columns
      for (let x = 0; x < width; x += 1) {
        row.push(y * width + x);
      }
      matrix.push(row);
    }

    this.state = {
      // width,
      // height,
      matrix,
    };

    // Keep an array of refs to the pixels for faster updating than re-rendering the dom
    this.pixelRefs = [];
    for (let i = 0; i < (height * width); i += 1) {
      this.pixelRefs.push(React.createRef());
    }

    this._bindEvents();
  }


  /**
   * @inheritdoc
   */
  componentWillUnmount = () => {
    this._unbindEvents();
  }


  /**
   * @description
   * Bind the events required to run the component
   */
  _bindEvents = () => {
    clientSocketHandler
      .on(CLIENT_SOCKET_HANDLER_EVENTS.MESSAGE, this._handleClientSocketHandlerMessage);
  }


  /**
   * @description
   * Unbind the events required to run the component
   */
  _unbindEvents = () => {
    clientSocketHandler
      .off(CLIENT_SOCKET_HANDLER_EVENTS.MESSAGE, this._handleClientSocketHandlerMessage);
  }


  /**
   * @description
   * Fired when a socket message comes from the server to update the emulator frame data
   *
   * @param {Uint32Array} pixelData
   */
  _handleUpdateEmulatorFrame = (pixelData) => {
    if (Array.isArray(pixelData)) {
      pixelData.forEach((pixel, index) => {
        if (this.pixelRefs[index].current) {
          const rgb = int2rgb(pixel);
          this.pixelRefs[index].current.style.backgroundColor = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        }
      });
    }
  }


  /**
   * @description
   * Fired whenever a message is received from the socket handler
   */
  _handleClientSocketHandlerMessage = (message, payload) => {
    switch (message) {
      case SERVER_SOCKET_MESSAGE.EMULATOR_FRAME:
        this._handleUpdateEmulatorFrame(payload.pixelData);
        break;
    }
  }


  /**
   * @inheritdoc
   */
  render() {
    const { matrix } = this.state;

    return (
      <div className="emulated-led-matrix">
        <div className="device-wrapper">
          <div className="device">
            {matrix.map((row, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={index} className="device-row">
                {row.map(pixel => (
                  <div className="pixel-wrapper" key={pixel}>
                    <div
                      ref={this.pixelRefs[pixel]}
                      className="device-pixel"
                      id={`pixel_${pixel}`}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
}

export default EmulatedLEDMatrix;
