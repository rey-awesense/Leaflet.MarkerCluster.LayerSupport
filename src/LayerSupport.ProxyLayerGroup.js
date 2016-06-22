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
