import { errors, isErrorType } from 'appium-base-driver';
import { unwrapEl, youiEngineDriverReturnValues } from '../utils';
import log from '../logger.js';
import _ from 'lodash';
import androidHelpers from '../android-helpers';
import B from 'bluebird';
import { asyncmap } from 'asyncbox';


let commands = {}, helpers = {};

commands.click = async function (el) {
  let retVal = await this.clickEl(el);
  return retVal;
};

commands.clickEl = async function (el) {

  el = unwrapEl(el);

  var commandObject = {
    name: 'click',
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

commands.clickElXY = async function (el, x, y) {

  log.debug("Entering clickElXY");

  el = unwrapEl(el);

  log.debug("Entering clickElXY");

  var commandObject = {
    name: 'tap',
    args: [`${el}`, `${x}`,`${y}`]
  };
  var commandJSON = JSON.stringify(commandObject);

  log.debug("clickElXY starting socket command: " + commandJSON);

  let data = await this.executeSocketCommand(commandJSON);

  log.debug("clickElXY function return data = " + data);

  let result;
  try {
    result = JSON.parse(data);
  } catch (e) {
    throw new Error("Bad response from clickElXY");
  }

  if (result.status == youiEngineDriverReturnValues.WEBDRIVER_UNKNOWN_COMMAND) {
    throw new errors.UnknownCommandError();
  } else if (result.status == youiEngineDriverReturnValues.WEBDRIVER_NO_SUCH_ELEMENT) {
    throw new errors.NoSuchElementError();
  } else if (result.status === youiEngineDriverReturnValues.WEBDRIVER_STALE_ELEMENT) {
    throw new errors.StaleElementReferenceError();
  }

  return result.value;
};

commands.clickXY = async function(x, y) {

  var commandObject = {
    name: 'tap',
    args: [`${x}`,`${y}`]
  };

  var commandJSON = JSON.stringify(commandObject);
  let data = await this.executeSocketCommand(commandJSON);

  let result;
  try {
    result = JSON.parse(data);
  } catch (e) {
    throw new Error("Bad response from clickXY");
  }

  // get status returned
  if (result.status === youiEngineDriverReturnValues.WEBDRIVER_STALE_ELEMENT)
    throw new errors.StaleElementReferenceError();

  return result.value;
}

commands.tap = async function (elementId, x = 0, y = 0, count = 1) {

  log.debug("entering tap function");

  for (let i = 0; i < count; i++) {

    if (elementId) {

      // we are either tapping on the default location of the element
      // or an offset from the top left corner

      if (x !== 0 || y !== 0) {
        log.debug("entering clickElXY function");
        await this.clickElXY(elementId, x, y);
      } else {
        log.debug("entering clickEl function");
        await this.clickEl(elementId);
      }
    } else {
      log.debug("entering clickXY function");
      await this.clickXY(x, y);
    }
  }
};


commands.doTouchAction = async function (action, opts) {

  log.debug("entering doTouchAction");

  switch (action) {
    case 'tap':
      log.debug("doTouchAction - do tap");
      return await this.tap(opts.element, opts.x, opts.y, opts.count);
    case 'press':
      return await this.touchDown(opts.element, opts.x, opts.y);
    case 'release':
      return await this.touchUp(opts.element, opts.x, opts.y);
    case 'moveTo':
      return await this.touchMove(opts.element, opts.x, opts.y);
    case 'wait':
      return await B.delay(opts.ms);
    case 'longPress':
      if (typeof opts.duration === 'undefined' || !opts.duration) {
        opts.duration = 1000;
      }
      return await this.touchLongClick(opts.element, opts.x, opts.y, opts.duration);
    case 'cancel':
      // TODO: clarify behavior of 'cancel' action and fix this
      log.warn("Cancel action currently has no effect");
      break;
    default:
      log.errorAndThrow(`unknown action ${action}`);
  }
};

// Perform one gesture
commands.performGesture = async function (gesture) {
  try {
    return await this.doTouchAction(gesture.action, gesture.options || {});
  } catch (e) {

    log.debug("caught error in performGesture: " + gesture);

    // sometime the element is not available when releasing, retry without it
    if (isErrorType(e, errors.NoSuchElementError) && gesture.action === 'release' &&
        gesture.options.element) {
      delete gesture.options.element;
      log.debug(`retrying release without element opts: ${gesture.options}.`);
      return await this.doTouchAction(gesture.action, gesture.options || {});
    }
    throw e;
  }
};

commands.parseTouch = async function (gestures, multi) {

  log.debug("entering parseTouch function");

  // because multi-touch releases at the end by default
  if (multi && _.last(gestures).action === 'release') {
    gestures.pop();
  }

  let touchStateObjects = await asyncmap(gestures, async (gesture) => {

    let options = gesture.options;

    if (_.includes(['press', 'moveTo', 'tap', 'longPress'], gesture.action)) {

      options.offset = false;
      let elementId = gesture.options.element;

      if (elementId) {
        log.debug("entering parseTouch function - element");

        let pos = await this.getLocation(elementId);
        let size = await this.getSize(elementId);

        if (gesture.options.x || gesture.options.y) {
          options.x = pos.x + (gesture.options.x || 0);
          options.y = pos.y + (gesture.options.y || 0);
        } else {
          options.x =  pos.x + (size.width / 2);
          options.y = pos.y + (size.height / 2);
        }
        let touchStateObject = {
          action: gesture.action,
          options,
          timeOffset: 0.005,
        };
        return touchStateObject;

      } else {

        log.debug("entering parseTouch function - coords");

        // expects absolute coordinates, so we need to save these as offsets
        // and then translate when everything is done

        options.offset = true;
        options.x = (gesture.options.x || 0);
        options.y = (gesture.options.y || 0);

        let touchStateObject = {
          action: gesture.action,
          options,
          timeOffset: 0.005,
        };

        return touchStateObject;
      }
    } else {
      let offset = 0.005;
      if (gesture.action === 'wait') {
        options = gesture.options;
        offset = (parseInt(gesture.options.ms) / 1000);
      }
      let touchStateObject = {
        action: gesture.action,
        options,
        timeOffset: offset,
      };
      return touchStateObject;
    }
  }, false);

  // we need to change the time (which is now an offset)
  // and the position (which may be an offset)

  let prevPos = null,
      time = 0;

  for (let state of touchStateObjects) {
    if (_.isUndefined(state.options.x) && _.isUndefined(state.options.y)) {
      // this happens with wait
      state.options.x = prevPos.x;
      state.options.y = prevPos.y;
    }
    if (state.options.offset && prevPos) {
      // the current position is an offset
      state.options.x += prevPos.x;
      state.options.y += prevPos.y;
    }
    delete state.options.offset;
    prevPos = state.options;

    if (multi) {
      var timeOffset = state.timeOffset;
      time += timeOffset;
      state.time = androidHelpers.truncateDecimals(time, 3);

      // multi gestures require 'touch' rather than 'options'
      state.touch = state.options;
      delete state.options;
    }
    delete state.timeOffset;
  }
  return touchStateObjects;
};

commands.performTouch = async function (gestures) {

  log.debug("entering performTouch function");

  // press-wait-moveTo-release is `swipe`, so use native method
  if (gestures.length === 4 &&
      gestures[0].action === 'press' &&
      gestures[1].action === 'wait' &&
      gestures[2].action === 'moveTo' &&
      gestures[3].action === 'release') {

    //let swipeOpts = await this.getSwipeOptions(gestures);
    //return await this.swipe(swipeOpts.startX, swipeOpts.startY, swipeOpts.endX,
    //                        swipeOpts.endY, swipeOpts.duration, swipeOpts.touchCount,
    //                        swipeOpts.element);
    throw new errors.NotYetImplementedError();

  }
  let actions =  _.map(gestures, "action");

  if (actions[0] === 'longPress' && actions[1] === 'moveTo' && actions[2] === 'release') {

    // return await this.doTouchDrag(gestures);
    throw new errors.NotYetImplementedError();

  } else {
    if (actions.length === 2) {
      // `press` without a wait is too slow and gets interpretted as a `longPress`
      if (_.first(actions) === 'press' && _.last(actions) === 'release') {
        actions[0] = 'tap';
        gestures[0].action = 'tap';
      }

      // the `longPress` and `tap` methods release on their own
      if ((_.first(actions) === 'tap' || _.first(actions) === 'longPress') && _.last(actions) === 'release') {
        gestures.pop();
        actions.pop();
      }
    } else {
      // longpress followed by anything other than release should become a press and wait
      if (actions[0] === 'longPress') {
        actions = ['press', 'wait', ...actions.slice(1)];

        let press = gestures.shift();
        press.action = 'press';
        let wait = {
          action: 'wait',
          options: {ms: press.options.duration || 1000}
        };
        delete press.options.duration;
        gestures = [press, wait, ...gestures];
      }
    }

    log.debug("trying parseTouch function");
    await this.parseTouch(gestures, false);

    log.debug("trying parseTouch function2");
    let fixedGestures = await this.parseTouch(gestures, false);

    // fix release action then perform all actions
    if (actions[actions.length - 1] === 'release') {
      actions[actions.length - 1] = await this.fixRelease(gestures);
    }
    for (let g of fixedGestures) {
      await this.performGesture(g);
    }
  }
};

export default commands;
