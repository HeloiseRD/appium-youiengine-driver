import { BaseDriver } from 'appium-base-driver';
import desiredCapConstraints from './desired-caps';
import logger from './logger';
import commands from './commands/index';
import _ from 'lodash';
import { errors } from 'mobile-json-wire-protocol';
import B from 'bluebird';

class YouiDriver extends BaseDriver {
  resetYoui () {

    this.ready = false;
    this.client = null;
  }

  constructor(opts, shouldValidateCaps) {
    super(opts, shouldValidateCaps);

    this.desiredCapConstraints = desiredCapConstraints;
    this.resetYoui();
  }

  validateLocatorStrategy (strategy) {
    super.validateLocatorStrategy(strategy, false);
  }

  async connectSocket() {
    
  let connectedPromise = new B((resolve) => {
      var net = require('net');

      var HOST = this.opts.deviceName;
      var PORT = 12345;
                               
      this.client = new net.Socket();
      this.client.setEncoding('utf8');
      this.client.connect(PORT, HOST, function() {

        logger.debug('CONNECTED TO: ' + HOST + ':' + PORT);
        resolve(true);
      });
      // Add a 'close' event handler for the client socket
      this.client.on('close', function() {
        logger.debug('Connection closed');
      });
    });
     
    this.ready = await connectedPromise;
  }
    
  async executeSocketCommand(cmd) {
        
    let cmdPromise = new B((resolve) => {
        logger.debug('COMMAND: ' + cmd);
        this.client.write(cmd, "UTF8",() => {
          this.client.on('data', function(data) {
             logger.debug('RESPONSE: ' + data);
             resolve(data);
        });
      });
    });
        
    return await cmdPromise;
  }

  async createSession (caps) {
    
    logger.debug("starting session")

    let [sessionId] = await super.createSession(caps);
    
    await this.connectSocket();

    // TODO: this should be in BaseDriver.postCreateSession
    this.startNewCommandTimeout('createSession');

    return [sessionId, this.opts];
      
  }

  async stop() {
    this.ready = false;
  }

  async deleteSession () {
    logger.debug("Deleting Youi session");

    await this.stop();
    await super.deleteSession();
  }

  async executeCommand (cmd, ...args) {
    if (cmd === 'receiveAsyncResponse') {
      logger.debug(`Executing Youi driver response '${cmd}'`);
      return await this.receiveAsyncResponse(...args);
    } else if (this.ready) {
      logger.debug(`Executing WebDriver command '${cmd}'`);
      return super.executeCommand(cmd, ...args);
    } else {
      logger.debug(`Command Error '${cmd}'`);

      throw new errors.NoSuchDriverError(`Driver is not ready, cannot execute ${cmd}.`);
    }
  }

  validateDesiredCaps (caps) {
    // check with the base class, and return if it fails
    let res = super.validateDesiredCaps(caps);
    if (!res) return res;
    // finally, return true since the superclass check passed, as did this
    return true;
  }
    

    
  async getSourceForElementForXML (ctx) {
        let source;
      
        source = await this.executeSocketCommand('GetSRC');

        if (source) {
            return source;
        } else {
            // this should never happen but we've received bug reports; this will help us track down
            // what's wrong in getTreeForXML
            throw new Error("Bad response from getTreeForXML");
        }
    }
}

for (let [cmd, fn] of _.pairs(commands)) {
  YouiDriver.prototype[cmd] = fn;
}

export { YouiDriver };