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
