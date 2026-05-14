// S72 display-only layout seed. These normalized positions serve the PixiJS UI
// and must never be treated as canonical geography or travel truth.
const MAP_VISUAL_LAYOUT_BY_REF = Object.freeze({
  "map:geography:country:country-ming": Object.freeze({ x: 0.50, y: 0.52, layer: "places", importance: 0.58, labelAnchor: "top" }),
  "map:geography:country:country-manchu-frontier": Object.freeze({ x: 0.73, y: 0.17, layer: "places", importance: 0.42, labelAnchor: "right" }),
  "map:geography:country:country-mongol-steppe": Object.freeze({ x: 0.29, y: 0.15, layer: "places", importance: 0.38, labelAnchor: "left" }),
  "map:geography:country:country-joseon": Object.freeze({ x: 0.82, y: 0.33, layer: "places", importance: 0.35, labelAnchor: "right" }),
  "map:geography:country:country-ryukyu": Object.freeze({ x: 0.77, y: 0.90, layer: "places", importance: 0.32, labelAnchor: "right" }),

  "map:geography:region:region-north-zhili": Object.freeze({ x: 0.51, y: 0.31, layer: "places", importance: 0.45, labelAnchor: "top" }),
  "map:geography:region:region-south-zhili": Object.freeze({ x: 0.56, y: 0.61, layer: "places", importance: 0.43, labelAnchor: "bottom" }),
  "map:geography:region:region-shandong": Object.freeze({ x: 0.55, y: 0.44, layer: "places", importance: 0.38, labelAnchor: "right" }),
  "map:geography:region:region-henan": Object.freeze({ x: 0.45, y: 0.49, layer: "places", importance: 0.38, labelAnchor: "left" }),
  "map:geography:region:region-shanxi-frontier": Object.freeze({ x: 0.36, y: 0.32, layer: "places", importance: 0.40, labelAnchor: "left" }),
  "map:geography:region:region-liaodong-beyond": Object.freeze({ x: 0.72, y: 0.22, layer: "places", importance: 0.34, labelAnchor: "right" }),
  "map:geography:region:region-jiangnan": Object.freeze({ x: 0.61, y: 0.69, layer: "places", importance: 0.44, labelAnchor: "bottom" }),
  "map:geography:region:region-south-coast": Object.freeze({ x: 0.50, y: 0.84, layer: "places", importance: 0.34, labelAnchor: "bottom" }),

  "map:geography:city:city-beijing": Object.freeze({ x: 0.51, y: 0.29, layer: "places", importance: 0.95, labelAnchor: "top", styleToken: "city_prefecture" }),
  "map:geography:city:city-nanjing": Object.freeze({ x: 0.55, y: 0.60, layer: "places", importance: 0.86, labelAnchor: "left", styleToken: "city_prefecture" }),
  "map:geography:city:city-suzhou": Object.freeze({ x: 0.61, y: 0.66, layer: "places", importance: 0.84, labelAnchor: "right", styleToken: "city_prefecture" }),
  "map:geography:city:city-hangzhou": Object.freeze({ x: 0.65, y: 0.70, layer: "places", importance: 0.72, labelAnchor: "right", styleToken: "city_prefecture" }),
  "map:geography:city:city-jinan": Object.freeze({ x: 0.55, y: 0.44, layer: "places", importance: 0.68, labelAnchor: "right", styleToken: "city_prefecture" }),
  "map:geography:city:city-kaifeng": Object.freeze({ x: 0.45, y: 0.49, layer: "places", importance: 0.66, labelAnchor: "left", styleToken: "city_prefecture" }),
  "map:geography:city:city-taiyuan": Object.freeze({ x: 0.38, y: 0.36, layer: "places", importance: 0.63, labelAnchor: "left", styleToken: "city_prefecture" }),
  "map:geography:city:city-datong": Object.freeze({ x: 0.34, y: 0.25, layer: "places", importance: 0.66, labelAnchor: "left", styleToken: "garrison" }),
  "map:geography:city:city-shanhai-pass": Object.freeze({ x: 0.62, y: 0.24, layer: "places", importance: 0.74, labelAnchor: "top", styleToken: "pass_fort" }),
  "map:geography:city:city-mukden": Object.freeze({ x: 0.73, y: 0.18, layer: "places", importance: 0.62, labelAnchor: "right", styleToken: "garrison" }),
  "map:geography:city:city-kharchin-camp": Object.freeze({ x: 0.28, y: 0.18, layer: "places", importance: 0.45, labelAnchor: "left", styleToken: "relay_station" }),
  "map:geography:city:city-hanseong": Object.freeze({ x: 0.82, y: 0.33, layer: "places", importance: 0.48, labelAnchor: "right", styleToken: "city_prefecture" }),
  "map:geography:city:city-guangzhou": Object.freeze({ x: 0.45, y: 0.85, layer: "places", importance: 0.58, labelAnchor: "bottom", styleToken: "trade_port" }),
  "map:geography:city:city-shuri": Object.freeze({ x: 0.75, y: 0.90, layer: "places", importance: 0.38, labelAnchor: "bottom", styleToken: "trade_port" }),

  "map:geography:frontier_zone:frontier-shanhai-liaodong": Object.freeze({ x: 0.67, y: 0.21, layer: "events", importance: 0.82, labelAnchor: "top", styleToken: "frontier_pressure" }),
  "map:geography:frontier_zone:frontier-datong-steppe": Object.freeze({ x: 0.31, y: 0.21, layer: "events", importance: 0.70, labelAnchor: "left", styleToken: "frontier_pressure" }),
  "map:geography:frontier_zone:frontier-joseon-liaodong": Object.freeze({ x: 0.77, y: 0.28, layer: "events", importance: 0.62, labelAnchor: "right", styleToken: "frontier_pressure" }),
  "map:geography:frontier_zone:frontier-south-sea-tribute": Object.freeze({ x: 0.62, y: 0.88, layer: "events", importance: 0.46, labelAnchor: "bottom", styleToken: "frontier_pressure" }),

  "map:geography:jurisdiction:jurisdiction-ministry-personnel-capital": Object.freeze({ x: 0.50, y: 0.27, layer: "places", importance: 0.58, labelAnchor: "top", styleToken: "edict" }),
  "map:geography:jurisdiction:jurisdiction-ministry-revenue-canal": Object.freeze({ x: 0.56, y: 0.52, layer: "places", importance: 0.58, labelAnchor: "right", styleToken: "edict" }),
  "map:geography:jurisdiction:jurisdiction-ministry-war-frontier": Object.freeze({ x: 0.50, y: 0.23, layer: "places", importance: 0.60, labelAnchor: "top", styleToken: "garrison" }),
  "map:geography:jurisdiction:jurisdiction-ministry-rites-tribute-exam": Object.freeze({ x: 0.57, y: 0.62, layer: "places", importance: 0.58, labelAnchor: "right", styleToken: "exam_hall" })
});

const MAP_VISUAL_ROUTE_BY_REF = Object.freeze({
  "map:geography:route:route-grand-canal-north": Object.freeze({
    type: "canal",
    fromRef: "map:geography:city:city-nanjing",
    toRef: "map:geography:city:city-beijing",
    controlRefs: Object.freeze(["map:geography:city:city-suzhou", "map:geography:city:city-jinan"]),
    layoutPath: Object.freeze([
      Object.freeze([0.55, 0.60]),
      Object.freeze([0.61, 0.66]),
      Object.freeze([0.55, 0.44]),
      Object.freeze([0.51, 0.29])
    ])
  }),
  "map:geography:route:route-yellow-river-kaifeng-jinan": Object.freeze({
    type: "river",
    fromRef: "map:geography:city:city-kaifeng",
    toRef: "map:geography:city:city-jinan",
    controlRefs: Object.freeze([]),
    layoutPath: Object.freeze([
      Object.freeze([0.45, 0.49]),
      Object.freeze([0.50, 0.47]),
      Object.freeze([0.55, 0.44])
    ])
  }),
  "map:geography:route:route-datong-beijing-frontier-road": Object.freeze({
    type: "road",
    fromRef: "map:geography:city:city-datong",
    toRef: "map:geography:city:city-beijing",
    controlRefs: Object.freeze(["map:geography:city:city-taiyuan"]),
    layoutPath: Object.freeze([
      Object.freeze([0.34, 0.25]),
      Object.freeze([0.38, 0.36]),
      Object.freeze([0.51, 0.29])
    ])
  }),
  "map:geography:route:route-shanhai-liaodong-pass": Object.freeze({
    type: "pass",
    fromRef: "map:geography:city:city-shanhai-pass",
    toRef: "map:geography:city:city-mukden",
    controlRefs: Object.freeze([]),
    layoutPath: Object.freeze([
      Object.freeze([0.62, 0.24]),
      Object.freeze([0.68, 0.20]),
      Object.freeze([0.73, 0.18])
    ])
  }),
  "map:geography:route:route-jiangnan-coastal-sea": Object.freeze({
    type: "sea",
    fromRef: "map:geography:city:city-guangzhou",
    toRef: "map:geography:city:city-hangzhou",
    controlRefs: Object.freeze(["map:geography:city:city-shuri"]),
    layoutPath: Object.freeze([
      Object.freeze([0.45, 0.85]),
      Object.freeze([0.75, 0.90]),
      Object.freeze([0.65, 0.70])
    ])
  })
});

module.exports = {
  MAP_VISUAL_LAYOUT_BY_REF,
  MAP_VISUAL_ROUTE_BY_REF
};
