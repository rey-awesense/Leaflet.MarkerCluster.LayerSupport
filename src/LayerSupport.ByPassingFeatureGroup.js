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
