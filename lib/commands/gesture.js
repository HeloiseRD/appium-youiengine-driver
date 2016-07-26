import { errors, isErrorType } from 'appium-base-driver';
import { unwrapEl, youiEngineDriverReturnValues } from '../utils';
import log from '../logger.js';
import _ from 'lodash';
import androidHelpers from '../android-helpers';
import B from 'bluebird';
import { asyncmap } from 'asyncbox';


let commands = {}, helpers = {};

commands.click = async function (el) {
  let retVal = await this.tapEl(el);
  return retVal;
};

commands.tapEl = async function (el, longPress) {

  // perform a tap on the given element
  // if longPress is true, the tap becomes a longPress action

  el = unwrapEl(el);

  let commandName = 'tap';
  if (longPress === true) {
    commandName = 'longpress';
  }

  var commandObject = {
    name: commandName,
    args: [`${el}`]
  };
  var commandJSON = JSON.stringify(commandObject);

  let data = await this.executeSocketCommand(commandJSON);

  let result;
  try {
    result = JSON.parse(data);
  } catch (e) {
    throw new Error("Bad response from click");
  }

  // get status returned
  if (result.status === youiEngineDriverReturnValues.WEBDRIVER_STALE_ELEMENT)
    throw new errors.StaleElementReferenceError();

  return result.value;
};

commands.tapElXY = async function (el, x, y, longPress) {

  // perform a tap on the given element at the given x,y offset
  // if longPress is true, the tap becomes a longPress action

  el = unwrapEl(el);

  let commandName = 'tap';
  if (longPress === true) {
    commandName = 'longpress';
  }

  var commandObject = {
    name: commandName,
    args: [`${el}`, `${x}`,`${y}`]
  };

  var commandJSON = JSON.stringify(commandObject);
  let data = await this.executeSocketCommand(commandJSON);

  let result;
  try {
    result = JSON.parse(data);
  } catch (e) {
    throw new Error("Bad response from tapElXY");
  }

  if (result.status === youiEngineDriverReturnValues.WEBDRIVER_UNKNOWN_COMMAND) {
    throw new errors.UnknownCommandError();
  } else if (result.status === youiEngineDriverReturnValues.WEBDRIVER_NO_SUCH_ELEMENT) {
    throw new errors.NoSuchElementError();
  } else if (result.status === youiEngineDriverReturnValues.WEBDRIVER_STALE_ELEMENT) {
    throw new errors.StaleElementReferenceError();
  }

  return result.value;
};

commands.tapXY = async function(x, y, longPress) {

  // perform a tap at the given x,y screen coordinate
  // if longPress is true, the tap becomes a longPress action

  let commandName = 'tap';
  if (longPress === true) {
    commandName = 'longpress';
  }

  var commandObject = {
    name: commandName,
    args: [`${x}`,`${y}`]
  };

  var commandJSON = JSON.stringify(commandObject);
  let data = await this.executeSocketCommand(commandJSON);

  let result;
  try {
    result = JSON.parse(data);
  } catch (e) {
    throw new Error("Bad response from tapXY");
  }

  // get status returned
  if (result.status === youiEngineDriverReturnValues.WEBDRIVER_STALE_ELEMENT)
    throw new errors.StaleElementReferenceError();

  return result.value;
}

commands.tap = async function (gestures, longPress) {

  // parse the given gestures array to call the appropriate tap method
  // if longPress is true, the tap is a long press action

  let elementId = gestures[0].options.element;
  let x = gestures[0].options.x;
  let y = gestures[0].options.y;

  if (elementId) {

    // we are either tapping on the default location of the element
    // or an offset from the top left corner

    if (x && y) {
        await this.tapElXY(elementId, x, y, longPress);
    } else {
        // tapping with an element parameter is the same as click on a WebElement so they can
        // filter through the same call stack
        await this.tapEl(elementId, longPress);
    }
  } else {

    // we are tapping at an absolute x,y coordinate on the screen
    await this.tapXY(x, y, longPress);
  }
};

commands.doSwipe = async function (gestures, longPress) {

  // parse input values
  let press = gestures[0];
  let moveTo = gestures[1];
  let startX = press.options.x || 0,
      startY = press.options.y || 0,
      endX = moveTo.options.x || 0,
      endY = moveTo.options.y || 0;

  if (press.options.element) {
    let {x, y} = await this.getLocation(press.options.element);
    startX += x || 0;
    startY += y || 0;
  }
  if (moveTo.options.element) {
    let {x, y} = await this.getLocation(press.options.element);
    endX += x || 0;
    endY += y || 0;
  }

  // construct the command object
  let commandName = 'swipe';
  if (longPress === true) {
    commandName = 'longpressswipe';
  }

  var commandObject = {
    name: commandName,
    args: [`${startX}`,`${startY}`,`${endX}`,`${endY}`]
  };

  var commandJSON = JSON.stringify(commandObject);
  let data = await this.executeSocketCommand(commandJSON);

  let result;
  try {
    result = JSON.parse(data);
  } catch (e) {
    throw new Error("Bad response from doSwipe");
  }

  // get status returned
  if (result.status === youiEngineDriverReturnValues.WEBDRIVER_STALE_ELEMENT)
    throw new errors.StaleElementReferenceError();

  return result.value;

};

commands.performTouch = async function (gestures) {

  if (gestures.length === 3) {

    if (gestures[0].action === 'press' && gestures[1].action === 'moveTo' && gestures[2].action === 'release') {

      return await this.doSwipe(gestures, false);

    } else if (gestures[0].action === 'longPress' && gestures[1].action === 'moveTo' && gestures[2].action === 'release') {

      return await this.doSwipe(gestures, true);
    }

  } else if (gestures.length === 2) {

    if (gestures[0].action === 'press' && gestures[1].action === 'release') {

      return await this.tap(gestures, false);

    } else if (gestures[0].action  === 'longPress' && gestures[1].action  === 'release') {

      return await this.tap(gestures, true);

    }
  }
};

export default commands;
