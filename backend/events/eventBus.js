// events/eventBus.js
import EventEmitter from "events";

const eventBus = new EventEmitter();

// increase if you expect many listeners
eventBus.setMaxListeners(50);

export default eventBus;
