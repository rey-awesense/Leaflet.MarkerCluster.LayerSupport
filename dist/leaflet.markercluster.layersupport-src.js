/**
 * @license leaflet.markercluster.layersupport v1.0.0-rc.1
 * Sub-plugin for Leaflet.markercluster. Brings compatibility with L.Control.Layers
 * (c) 2015-2016 Boris Seang
 * License: MIT
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['leaflet'], function (L) {
      return (L.MarkerClusterGroup.LayerSupport = factory(L));
    });
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('leaflet'));
  } else {
    root.L.MarkerClusterGroup.LayerSupport = factory(root.L);
  }
}(this, function (L) {
  var LMCG = L.MarkerClusterGroup;
var LMCGproto = LMCG.prototype;

/**
 * Extends the L.MarkerClusterGroup class by mainly overriding methods for
 * addition/removal of layers, so that they can also be directly added/removed
 * from the map later on while still clustering in this group.
 *
 * @type {L.MarkerClusterGroup}
 */
LMCG.LayerSupport = LMCG.extend({
  statics: {
    version: '1.0.0-rc.1'
  },

  options: {
    /**
     * Buffer single addLayer and removeLayer requests for efficiency.
     * @type {Number}
     */
    singleAddRemoveBufferDuration: 100
  },

  initialize: function (options) {
    LMCGproto.initialize.call(this, options);

    this._originalAddLayer = LMCGproto.addLayer;
    this._originalAddLayers = LMCGproto.addLayers;

    this._originalRemoveLayer = LMCGproto.removeLayer;
    this._originalRemoveLayers = LMCGproto.removeLayers;

    // Replace the MCG internal featureGroup's so that they directly
    // access the map add/removal methods, bypassing the switch agent.
    this._featureGroup = new LMCG.LayerSupport.ByPassingFeatureGroup();
    this._featureGroup.addEventParent(this);

    this._nonPointGroup = new LMCG.LayerSupport.ByPassingFeatureGroup();
    this._nonPointGroup.addEventParent(this);

    // Keep track of what should be "represented" on map (can be clustered).
    this._layers = {};
    this._proxyLayerGroups = {};
    this._proxyLayerGroupsNeedRemoving = {};

    // Buffer single addLayer and removeLayer requests.
    this._singleAddRemoveBuffer = [];
  },

  /**
   * Stamps the passed layers as being part of this group, but without adding
   * them to the map right now.
   *
   * @param layers L.Layer|Array(L.Layer) layer(s) to be stamped.
   * @returns {MarkerClusterGroupLayerSupport} this.
   */
  checkIn: function (layers) {
    var layersArray = this._toArray(layers);

    this._checkInGetSeparated(layersArray);

    return this;
  },

  /**
   * Un-stamps the passed layers from being part of this group. It has to
   * remove them from map (if they are) since they will no longer cluster.
   *
   * @param layers L.Layer|Array(L.Layer) layer(s) to be un-stamped.
   * @returns {MarkerClusterGroupLayerSupport} this.
   */
  checkOut: function (layers) {
    var layersArray = this._toArray(layers);
    var separated = this._separateSingleFromGroupLayers(layersArray, {
      groups: [],
      singles: []
    });
    var groups = separated.groups;
    var singles = separated.singles;
    var layer;
    var i;

    // Un-stamp single layers.
    for (i = 0; i < singles.length; i++) {
      layer = singles[i];
      delete this._layers[L.stamp(layer)];
      delete layer._mcgLayerSupportGroup;
    }

    // Batch remove single layers from MCG.
    // Note: as for standard MCG, if single layers have been added to
    // another MCG in the meantime, their __parent will have changed,
    // so weird things would happen.
    this._originalRemoveLayers(singles);

    // Dismiss Layer Groups.
    for (i = 0; i < groups.length; i++) {
      layer = groups[i];
      this._dismissProxyLayerGroup(layer);
    }

    return this;
  },

  addLayer: function (layer) {
    this._bufferSingleAddRemove(layer, 'addLayers');
    return this;
  },

  /**
   * Checks in and adds an array of layers to this group.
   * Layer Groups are also added to the map to fire their event.
   *
   * @param layers (L.Layer|L.Layer[]) single and/or group layers to be added.
   * @returns {MarkerClusterGroupLayerSupport} this.
   */
  addLayers: function (layers) {
    var layersArray = this._toArray(layers);
    var separated = this._checkInGetSeparated(layersArray);
    var groups = separated.groups;
    var group;
    var id;
    var i;

    this._originalAddLayers(separated.singles);

    for (i = 0; i < groups.length; i++) {
      group = groups[i];
      id = L.stamp(group);
      this._proxyLayerGroups[id] = group;
      delete this._proxyLayerGroupsNeedRemoving[id];
      if (this._map) {
        this._map._originalAddLayer(group);
      }
    }
  },

  removeLayer: function (layer) {
    this._bufferSingleAddRemove(layer, 'removeLayers');
    return this;
  },

  /**
   * Removes layers from this group but without check out.
   * Layer Groups are also removed from the map to fire their event.
   *
   * @param layers (L.Layer|L.Layer[]) single and/or group layers to be removed.
   * @returns {MarkerClusterGroupLayerSupport} this.
   */
  removeLayers: function (layers) {
    var layersArray = this._toArray(layers);
    var separated = this._separateSingleFromGroupLayers(layersArray, {
      groups: [],
      singles: []
    });
    var groups = separated.groups;
    var singles = separated.singles;
    var group;
    var id;
    var i;

    // Batch remove single layers from MCG.
    this._originalRemoveLayers(singles);

    for (i = 0; i < groups.length; i++) {
      group = groups[i];
      id = L.stamp(group);
      delete this._proxyLayerGroups[id];
      if (this._map) {
        this._map._originalRemoveLayer(group);
      } else {
        this._proxyLayerGroupsNeedRemoving[id] = group;
      }
    }

    return this;
  },

  onAdd: function (map) {
    map._originalAddLayer = map._originalAddLayer || map.addLayer;
    map._originalRemoveLayer = map._originalRemoveLayer || map.removeLayer;
    L.extend(map, LMCG.LayerSupport.LayerSwitchMap);

    var toBeReAdded = this._removePreAddedLayers(map);
    var id;
    var group;
    var i;

    LMCGproto.onAdd.call(this, map);

    for (id in this._proxyLayerGroups) {
      group = this._proxyLayerGroups[id];
      map._originalAddLayer(group);
    }

    for (id in this._proxyLayerGroupsNeedRemoving) {
      group = this._proxyLayerGroupsNeedRemoving[id];
      map._originalRemoveLayer(group);
      delete this._proxyLayerGroupsNeedRemoving[id];
    }

    for (i = 0; i < toBeReAdded.length; i++) {
      map.addLayer(toBeReAdded[i]);
    }
  },

  _checkInGetSeparated: function (layersArray) {
    var separated = this._separateSingleFromGroupLayers(layersArray, {
      groups: [],
      singles: []
    });
    var groups = separated.groups;
    var singles = separated.singles;
    var layer;
    var i;

    for (i = 0; i < groups.length; i++) {
      layer = groups[i];
      this._recruitLayerGroupAsProxy(layer);
    }

    for (i = 0; i < singles.length; i++) {
      layer = singles[i];

      this._removeFromOtherGroupsOrMap(layer);
      this._layers[L.stamp(layer)] = layer;
      layer._mcgLayerSupportGroup = this;
    }

    return separated;
  },

  _separateSingleFromGroupLayers: function(inputLayers, output) {
    var groups = output.groups;
    var singles = output.singles;
    var isArray = L.Util.isArray;
    var layer;

    for (var i = 0; i < inputLayers.length; i++) {
      layer = inputLayers[i];

      if (layer instanceof L.LayerGroup) {
        groups.push(layer);
        this._separateSingleFromGroupLayers(layer.getLayers(), output);
        continue;
      } else if (isArray(layer)) {
        this._separateSingleFromGroupLayers(layer, output);
        continue;
      }

      singles.push(layer);
    }

    return output;
  },

  _dismissProxyLayerGroup: function (layerGroup) {
    if (layerGroup._proxyMCGLayerSupportGroup === undefined || layerGroup._proxyMCGLayerSupportGroup !== this) {
      return;
    }

    delete layerGroup._proxyMCGLayerSupportGroup;
    layerGroup.addLayer = layerGroup._originalAddLayer;
    layerGroup.removeLayer = layerGroup._originalRemoveLayer;

    var id = L.stamp(layerGroup);
    delete this._proxyLayerGroups[id];
    delete this._proxyLayerGroupsNeedRemoving[id];

    this._removeFromOwnMap(layerGroup);
  },

  _recruitLayerGroupAsProxy: function(layerGroup) {
    var otherMCGLayerSupportGroup = layerGroup._proxyMCGLayerSupportGroup;

    if (otherMCGLayerSupportGroup) {
      if (otherMCGLayerSupportGroup === this) {
        return;
      }
      otherMCGLayerSupportGroup.checkOut(layerGroup);
    } else {
      this._removeFromOwnMap(layerGroup);
    }

    layerGroup._proxyMCGLayerSupportGroup = this;
    layerGroup._originalAddLayer = layerGroup._originalAddLayer || layerGroup.addLayer;
    layerGroup._originalRemoveLayer = layerGroup._originalRemoveLayer || layerGroup.removeLayer;

    L.extend(layerGroup, LMCG.LayerSupport.ProxyLayerGroup);
  },

  _removeFromOtherGroupsOrMap: function (layer) {
    var otherMCGLayerSupportGroup = layer._mcgLayerSupportGroup;

    if (otherMCGLayerSupportGroup) {
      if (otherMCGLayerSupportGroup === this) {
        return;
      }
      otherMCGLayerSupportGroup.checkOut(layer);
    } else if (layer.__parent) {
      layer.__parent._group.removeLayer(layer);
    } else {
      this._removeFromOwnMap(layer);
    }
  },

  _removeFromOwnMap: function (layer) {
    // TODO: Is this conditional necessary in L1.0?
    if (layer._map) {
      layer._map.removeLayer(layer);
    }
  },

  _removePreAddedLayers: function (map) {
    var layers = this._layers;
    var toBeReAdded = [];
    var layer;

    for (var id in layers) {
      layer = layers[id];
      if (layer._map) {
        toBeReAdded.push(layer);
        map._originalRemoveLayer(layer);
      }
    }

    return toBeReAdded;
  },

  _bufferSingleAddRemove: function (layer, operationType) {
    var duration = this.options.singleAddRemoveBufferDuration;
    var fn;

    if (duration > 0) {
      this._singleAddRemoveBuffer.push({
        type: operationType,
        layer: layer
      });

      if (!this._singleAddRemoveBufferTimeout) {
        fn = L.bind(this._processSingleAddRemoveBuffer, this);
        this._singleAddRemoveBufferTimeout = setTimeout(fn, duration);
      }
    } else {
      this[operationType](layer);
    }
  },

  _processSingleAddRemoveBuffer: function () {
    var _singleAddRemoveBuffer = this._singleAddRemoveBuffer;
    var layersBuffer = [];
    var currentOperation;
    var currentOperationType;
    var i;

    for (i = 0; i < _singleAddRemoveBuffer.length; i++) {
      currentOperation = _singleAddRemoveBuffer[i];
      if (!currentOperationType) {
        currentOperationType = currentOperation.type;
      }
      if (currentOperation.type === currentOperationType) {
        layersBuffer.push(currentOperation.layer);
      } else {
        this[currentOperationType](layersBuffer);
        layersBuffer = [currentOperation.layer];
      }
    }

    this[currentOperationType](layersBuffer);
    _singleAddRemoveBuffer.length = 0;
    clearTimeout(this._singleAddRemoveBufferTimeout);
    this._singleAddRemoveBufferTimeout = null;
  },

  _toArray: function (item) {
    return L.Util.isArray(item) ? item : [item];
  }
});

L.markerClusterGroup.layerSupport = function (options) {
  return new LMCG.LayerSupport(options);
};
var LMCG = L.MarkerClusterGroup;

LMCG.LayerSupport.ByPassingFeatureGroup = L.FeatureGroup.extend({
  addLayer: function (layer) {
    if (this.hasLayer(layer)) {
      return this;
    }

    layer.addEventParent(this);

    var id = L.stamp(layer);

    this._layers[id] = layer;

    if (this._map) {
      this._map._originalAddLayer(layer);
    }

    return this.fire('layeradd', {layer: layer});
  },
  removeLayer: function (layer) {
    if (!this.hasLayer(layer)) {
      return this;
    }

    if (layer in this._layers) {
      layer = this._layers[layer];
    }

    layer.removeEventParent(this);

    var id = L.stamp(layer);

    if (this._map && this._layers[id]) {
      this._map._originalRemoveLayer(this._layers[id]);
    }

    delete this._layers[id];

    return this.fire('layerremove', {layer: layer});
  },
  onAdd: function (map) {
    this._map = map;
    this.eachLayer(map._originalAddLayer, map);
  },
  onRemove: function (map) {
    this.eachLayer(map._originalRemoveLayer, map);
    this._map = null;
  }
});
var LMCG = L.MarkerClusterGroup;

/**
 * Toolbox to equip LayerGroups recruited as proxy.
 *
 * @type {{addLayer: Function, removeLayer: Function}}
 */
LMCG.LayerSupport.ProxyLayerGroup = {
  /**
   * Re-implements to redirect addLayer to Layer Support group instead of map.
   *
   * @param layer L.Layer single layer to be added.
   * @returns {LMCG.LayerSupport.ProxyLayerGroup} this
   */
  addLayer: function (layer) {
    var id = this.getLayerId(layer);

    this._layers[id] = layer;

    if (this._map) {
      this._proxyMCGLayerSupportGroup.addLayer(layer);
    } else {
      this._proxyMCGLayerSupportGroup.checkIn(layer);
    }

    return this;
  },
  /**
   * Re-implements to redirect removeLayer to Layer Support group instead of map.
   *
   * @param layer L.Layer single layer to be added.
   * @returns {LMCG.LayerSupport.ProxyLayerGroup} this
   */
  removeLayer: function (layer) {
    var id = layer in this._layers ? layer : this.getLayerId(layer);

    this._proxyMCGLayerSupportGroup.removeLayer(layer);

    delete this._layers[id];

    return this;
  }
};
var LMCG = L.MarkerClusterGroup;

/**
 * Toolbox to equip the Map with a switch agent that redirects layers
 * addition/removal to their Layer Support group when defined.
 *
 * @type {{addLayer: Function, removeLayer: Function}}
 */
LMCG.LayerSupport.LayerSwitchMap = {
  addLayer: function (layer) {
    if (layer._mcgLayerSupportGroup) {
      // Use the original MCG addLayer.
      return layer._mcgLayerSupportGroup._originalAddLayer(layer);
    }
    return this._originalAddLayer(layer);
  },
  removeLayer: function (layer) {
    if (layer._mcgLayerSupportGroup) {
      // Use the original MCG removeLayer.
      return layer._mcgLayerSupportGroup._originalRemoveLayer(layer);
    }
    return this._originalRemoveLayer(layer);
  }
};

  return L.MarkerClusterGroup.LayerSupport;
}));
