/**
 * ACode Engine - Core
 * Engine ringan berbasis pattern ECS (Entity-Component-System)
 * untuk Extinct Survival.
 */
const ACode = (function () {
  'use strict';

  const DEBUG = true;
  function log(...args) {
    if (DEBUG) console.log('[ACode]', ...args);
  }

  // ---------- Entity ----------
  class Entity {
    constructor(id) {
      this.id = id;
      this.components = {};
    }
    addComponent(component) {
      this.components[component.constructor.name] = component;
      return this;
    }
    getComponent(name) {
      return this.components[name];
    }
    hasComponent(name) {
      return Object.prototype.hasOwnProperty.call(this.components, name);
    }
  }

  // ---------- Component (base) ----------
  class Component {
    constructor(data = {}) {
      Object.assign(this, data);
    }
  }

  // ---------- System (base) ----------
  class System {
    constructor(engine) {
      this.engine = engine;
    }
    // Override di subclass
    update(deltaTime) {}
  }

  // ---------- Engine ----------
  class Engine {
    constructor() {
      this.entities = new Map();
      this.systems = [];
      this.lastTick = Date.now();
      this._loopHandle = null;
      this._tickIntervalMs = 1000; // 1 detik per tick game loop
    }

    createEntity(id) {
      const e = new Entity(id);
      this.entities.set(id, e);
      return e;
    }

    getEntity(id) {
      return this.entities.get(id);
    }

    removeEntity(id) {
      this.entities.delete(id);
    }

    addSystem(system) {
      this.systems.push(system);
      return this;
    }

    start() {
      log('Engine started');
      this.lastTick = Date.now();
      this._loopHandle = setInterval(() => this._tick(), this._tickIntervalMs);
    }

    stop() {
      if (this._loopHandle) clearInterval(this._loopHandle);
      log('Engine stopped');
    }

    _tick() {
      const now = Date.now();
      const deltaTime = (now - this.lastTick) / 1000; // detik
      this.lastTick = now;
      for (const system of this.systems) {
        system.update(deltaTime);
      }
    }
  }

  return { Engine, Entity, Component, System, log, DEBUG };
})();
