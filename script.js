let coast;
svgNS = "http://www.w3.org/2000/svg";
let cells = [];
let elevationRange = [0, 0];
let heightRange = [null, null];
let colors = {};
let tideInterval;
let tideIsRunning = false;
let tideDirection = "falling";  // "rising" or "falling"
let tideRefreshRate = 100;
let tideMargin = 5;  // units tide reaches above and below highest and lowest elevation points
let seed = Math.floor(Math.random() * 100000);
let setSeed = null;
if ( setSeed ) seed = setSeed;

// general settings

let svgStyle = "lines";  // "lines" or "cells"
const subdivisions = 5;
const variationFactor = .85;
const seaLevelInit = 0;
let seaLevel = seaLevelInit;  // (in elevation units)

// lines view settings

let lvs_plain = { llw: 0.75, llc: "#555", lbc: "#FFFFFF", slw: .3, slc: "#555", sbc: "#FFFFFF", slf: 3, skc: "#FFF" };
let lvs_plain_with_fade = { llw: 0.75, llc: "#555", lbc: "#FFFFFF", slw: .3, slc: "#555", sbc: "#FFFFFF", slf: 3, skc: "#FFF", distanceFadeOpacityMin: 0.25, distanceFadeStartFromHorizon: .4 };
let lvs_plainblue = { llw: 0.65, llc: "#00bdfc", lbc: "#FFFFFF", slw: .65, slc: "#00bdfc5", sbc: "#FFFFFF", slf: 3, skc: "#FFF" };
let lvs_electricMagenta = { llw: 1.5, llc: "yellow", lbc: "magenta", slw: .75, slc: "white", sbc: "#00bdfc", slf: 4, skc: "#fc2a0a" };
let lvs_icebergs = { llw: 1.5, llc: "white", lbc: "#32dbfc", slw: 1, slc: "white", sbc: "#32dbfc", slf: 4, skc: "#32dbfc" };
let lvs_tropical = { llw: 0.75, llc: "#014501", lbc: "#529213", slw: .75, slc: "#FFFFFF", sbc: "#22d8ef", slf: 3, skc: "#006aef" };
let lvs_muted_pink_blue = { llw: 1, llc: "#7CA5C2", lbc: "#FFFFFF", slw: 2, slc: "#FFFFFF", sbc: "#FFEEEB", slf: 4, skc: "#FFFDFA", distanceFadeOpacityMin: 0.25, distanceFadeStartFromHorizon: .4 };

let lvs_playground = { llw: 1, llc: "#7CA5C2", lbc: "#FFFFFF", slw: 2, slc: "#FFFFFF", sbc: "#E4F2EE", slf: 4, skc: "#FFFDFA", distanceFadeOpacityMin: 0.25, distanceFadeStartFromHorizon: .4 };

let lvs = lvs_muted_pink_blue; // line view settings

let landLineWidth = lvs.llw;
let landLineColor = lvs.llc;   
let landBackgroundColor = lvs.lbc;

let seaLineWidth = lvs.slw;
let seaLineColor = lvs.slc; 
let seaBackgroundColor = lvs.sbc;
let seaLineFrequency = lvs.slf;

let skyColor = lvs.skc;

// cells view settings

let waterColor = "#121f26";
let landColorBase = "rgb(200, 200, 200)";
let maxHeightFactor = 3;  // lightest color at this many times base cell height
let maxLight = "rgb(255,255,255)";
let maxDark = "rgb(0,0,0)";




function randomRatio() {
  seed = ( seed * 16807 ) % 2147483647;
  return ( seed - 1 ) / 2147483646;
}


function randBetween( min, max ) {
  return randomRatio() * ( max - min ) + min;
}



function Cell( topLeftElCoord ) {
  let type = "water";
  let polygon = null;
  let height = null;
  let row = topLeftElCoord[0];
  let column = topLeftElCoord[1];
  let allElCoords = [
    [ row, column ],  // top left
    [ row, column+1 ],  // top right 
    [ row+1, column+1 ],  // bottom right
    [ row+1, column ]  // bottom left 
  ];
  let allElCoordsScaled = [];
  let points = ``;
  for ( let coord of allElCoords ) {
    let x = coord[1];
    let y = coord[0];
    let scaleFactor = coast.gridSize / ( coast.elevationMapPtsSize - 1 );
    let elevation = Math.max( coast.elevationMap[y][x], seaLevel );
    let xVal = x * scaleFactor;
    let yVal = y * scaleFactor - elevation;
    allElCoordsScaled.push( [ yVal, xVal ] );
    points += `${ xVal },${ coast.skyHeight + yVal } `;
    if ( coast.elevationMap[y][x] > seaLevel ) type = "land";
  }
  if ( type != "water" ) {
    let leftHeight = Math.abs( allElCoordsScaled[0][0] - allElCoordsScaled[3][0] );
    let rightHeight = Math.abs( allElCoordsScaled[1][0] - allElCoordsScaled[2][0] );
    height = ( leftHeight + rightHeight ) / 2;  // avg of both sides
    if ( heightRange[0] == null || height < heightRange[0] ) heightRange[0] = height;
    if ( heightRange[1] == null || height > heightRange[1] ) heightRange[1] = height;
    let polygon = document.createElementNS( svgNS, "polygon" );
    cellFillColor = getFillColor(height);
    cellLineColor = cellFillColor;
    cellLineWidth = 1;
    polygon.setAttribute( "points", points );
    polygon.setAttribute( "stroke-width", cellLineWidth );
    polygon.setAttribute( "stroke", cellLineColor );
    polygon.setAttribute( "fill", cellFillColor );
    polygon.setAttribute( "id", `r${row}-c${column}` );
    polygon.setAttribute( "class", type );
    document.querySelector("svg .cells").appendChild( polygon );
  }
  this.id = `r${row}-c${column}`;
  this.row = row;
  this.column = column;
  this.type = type;  // "water" or "land" (maybe later add, snow, grass, forest, etc.)
  this.ptTL = allElCoordsScaled[0];  // top left
  this.ptTR = allElCoordsScaled[1];  // top right
  this.ptBR = allElCoordsScaled[2];  // bottom right
  this.ptBL = allElCoordsScaled[3];  // bottom left
  this.height = height;
  this.polygon = polygon;
}


function init() {
  const viewBox = $("svg").attr("viewBox").split(" ");
  const gridSize = parseInt(viewBox[2]);
  const elevationMapSize = ( 4 ** subdivisions ) / 2 + 1;
  coast = {
    seed: seed,
    gridSize: gridSize,
    elevationMap: Array.from({ length: elevationMapSize }, () => Array(elevationMapSize).fill(0)),
    elevationMapPtsSize: elevationMapSize,
    skyHeight: Math.round(parseInt(viewBox[3]) * 0.3333),
    landCellHeightRange: heightRange
  };
  initializeCorners();
  applyDiamondSquareFractal();
  recordElevationMinMax();
  setColors();
  populateSVG();
  console.log("coast:", coast);
  console.log("cells:", cells);
}


function initializeCorners() {
  const maxEl = coast.gridSize * variationFactor / 2;
  const minEl = -maxEl/2;
  const elevationMapSize = coast.elevationMapPtsSize - 1;
  coast.elevationMap[0][0] = randBetween(minEl, maxEl) | 0;  // upper left
  coast.elevationMap[0][elevationMapSize] = randBetween(minEl, maxEl) | 0;  // upper right
  coast.elevationMap[elevationMapSize][0] = randBetween(minEl, 0) | 0;  // lower left (max 0)
  coast.elevationMap[elevationMapSize][elevationMapSize] = randBetween(minEl, 0) | 0;  // lower right (max 0)
}


function applyDiamondSquareFractal() {
  let size = coast.elevationMapPtsSize - 1;
  for ( let step = size; step > 1; step /= 2 ) {
    const half = step / 2;
    // diamond: set centers
    for ( let y = half; y < size; y += step ) {
      for ( let x = half; x < size; x += step ) {
        setDiamondCenter( x, y, half );
      }
    }
    // square: set edge midpoints
    for ( let y = 0; y <= size; y += half ) {
      for ( let x = ( y + half ) % step; x <= size; x += step ) {
        setDiamondTips( x, y, half );
      }
    }
    // normalize bottom row to 0 max elevation ()
    const bottomRow = coast.elevationMap[ coast.elevationMap.length - 1 ];
    const maxVal = Math.max(...bottomRow);
    if ( maxVal > 0 ) { for ( let x = 0; x < bottomRow.length; x++ ) bottomRow[x] -= maxVal; }
  }
}


function setDiamondCenter( x, y, half ) {
  const avg = (
    coast.elevationMap[ y - half ][ x - half ] +
    coast.elevationMap[ y - half ][ x + half ] +
    coast.elevationMap[ y + half ][ x - half ] +
    coast.elevationMap[ y + half ][ x + half ]
  ) / 4;
  const offset = getVariationOffset(half);
  coast.elevationMap[y][x] = Math.round(avg + offset);
}


function setDiamondTips( x, y, half ) {
  const values = [];
  if (y - half >= 0) values.push(coast.elevationMap[y - half][x]);
  if (x - half >= 0) values.push(coast.elevationMap[y][x - half]);
  if (x + half < coast.elevationMap.length) values.push(coast.elevationMap[y][x + half]);
  if (y + half < coast.elevationMap.length) values.push(coast.elevationMap[y + half][x]);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const offset = getVariationOffset(half);
  coast.elevationMap[y][x] = Math.round(avg + offset);
}


function getVariationOffset( half ) {
  const dist = coast.gridSize / ( coast.elevationMapPtsSize - 1 ) * half;
  return randBetween( -dist * variationFactor / 2, dist * variationFactor / 2 );
}


function recordElevationMinMax() {
  for (let row of coast.elevationMap) {
    for (let val of row) {
      if (val < elevationRange[0]) elevationRange[0] = val;
      if (val > elevationRange[1]) elevationRange[1] = val;
    }
  }
  coast.elevationRange = elevationRange;
}


function startTide() {
  clearInterval( tideInterval );
  tideInterval = setInterval( ()=> {
    let minEl = coast.elevationRange[0]; 
    let maxEl = coast.elevationRange[1];
    let imageBottom = coast.elevationMapPtsSize/-2;
    let minSeaLevel = minEl > imageBottom ? minEl - tideMargin : imageBottom - tideMargin;
    let maxSeaLevel = maxEl + tideMargin;
    if ( tideDirection == "falling" ) {
      seaLevel--;
      if ( seaLevel <= minSeaLevel ) tideDirection = "rising";
    } else if ( tideDirection == "rising" ) {
      seaLevel++;
      if ( seaLevel >= maxSeaLevel ) tideDirection = "falling";
    }
    populateSVG();
  }, tideRefreshRate);
  tideIsRunning = true;
  $(".button.tide").text("pause tide");
  $(".button.reverse-tide").show();
  $(".button.download-svg, .button.download-png").hide();
}


function pauseTide() {
  tideIsRunning = false;
  clearInterval( tideInterval );
  $(".button.tide").text("run tide");
  $(".button.reverse-tide").hide();
  $(".button.download-svg, .button.download-png").show();
}


function toggleTide() {
  tideIsRunning ? pauseTide() : startTide();
}


function reverseTideDirection() {
  tideDirection = tideDirection == "rising" ? "falling" : "rising";
}


function populateLines() {
  $(".lines").empty();
  $(".lines-backgrounds").empty();  
  // background (sky)
  $(".background").attr("fill", skyColor);
  const scaleFactor = coast.gridSize / (coast.elevationMapPtsSize - 1);
  const svgWidth = coast.gridSize;
  const svgHeight = coast.skyHeight + coast.elevationMap.length * scaleFactor;
  const totalRows = coast.elevationMap.length + coast.elevationRange[1];
  // place shapes and lines
  for (let y = 0; y < totalRows; y++) {
    const row = coast.elevationMap[y] ? coast.elevationMap[y] : Array(coast.elevationMap[0].length).fill(coast.elevationRange[0]);
    const segments = [];
    let currentSegment = [];
    let currentType = null;
    // apply distance fade if settings present
    let opacity = 1;
    if ( lvs.distanceFadeOpacityMin && lvs.distanceFadeStartFromHorizon ) {
      const midRow = totalRows * lvs.distanceFadeStartFromHorizon;
      if ( y <= midRow ) {
        const opacityRatio = midRow > 0 ? y / midRow : 1;
        opacity = lvs.distanceFadeOpacityMin + (opacityRatio * (1-lvs.distanceFadeOpacityMin) );
      } else {
        opacity = 1;
      }
    }
    // build sea/land segments with full row data
    const fullRowData = [];
    for (let x = 0; x < row.length; x++) {
      const rawElevation = row[x];
      const elevation = Math.max(rawElevation, seaLevel);
      const xVal = x * scaleFactor;
      const yVal = coast.skyHeight + (y * scaleFactor - elevation);
      const point = `${xVal},${yVal}`;
      const land =  // "land" if above sea level or adjacent to land
        rawElevation > seaLevel ||
        (x > 0 && row[x - 1] > seaLevel) ||
        (x < row.length - 1 && row[x + 1] > seaLevel);
      const segmentType = land ? "land" : "sea";
      fullRowData.push({ x, point, type: segmentType, xVal, yVal });
      if (currentType && segmentType !== currentType) {
        segments.push({ type: currentType, points: currentSegment, startX: currentSegment[0].x, endX: currentSegment[currentSegment.length - 1].x });
        currentSegment = [];
      }
      currentSegment.push({ x, point, xVal, yVal });
      currentType = segmentType;
    }
    if (currentSegment.length) { 
      segments.push({ type: currentType, points: currentSegment, startX: currentSegment[0].x, endX: currentSegment[currentSegment.length - 1].x }); 
    }
    // create and append background shapes
    const ySea = coast.skyHeight + (y * scaleFactor - seaLevel);
    const yNextRow = coast.skyHeight + ((y + 1) * scaleFactor - seaLevel);
    segments.forEach((seg) => {
      if (seg.type === "land") {
        // land background
        const topPts = seg.points.map(p => [p.xVal, p.yVal]);
        const bottomPts = topPts.slice().reverse().map(([x]) => [x, ySea]);
        const polygonPoints = [...topPts, ...bottomPts];
        const polygon = document.createElementNS(svgNS, "polygon");
        polygon.setAttribute("points", polygonPoints.map(p => p.join(",")).join(" "));
        polygon.setAttribute("fill", landBackgroundColor);
        polygon.setAttribute("opacity", opacity);
        $(".lines-backgrounds").append(polygon);
      } else {
        // sea background
        const topPts = seg.points.map(p => [p.xVal, p.yVal]);
        // Bottom edge: same x positions at next row's sea level
        const bottomPts = topPts.slice().reverse().map(([x]) => [x, yNextRow]);
        const polygonPoints = [...topPts, ...bottomPts];
        const polygon = document.createElementNS(svgNS, "polygon");
        polygon.setAttribute("points", polygonPoints.map(p => p.join(",")).join(" "));
        polygon.setAttribute("fill", seaBackgroundColor);
        polygon.setAttribute("opacity", opacity);
        $(".lines-backgrounds").append(polygon);
      }
    });
    // create and append lines with extended sea segments
    segments.forEach((seg, segIndex) => {
      const shouldDrawSea = seg.type === "sea" && y % seaLineFrequency === 1;
      if (seg.type === "land" || shouldDrawSea) {
        let pointsToUse = seg.points.map(p => p.point);
        // Extend sea segments to connect with adjacent land or edges
        if (seg.type === "sea") {
          // Check if there's a land segment before this sea segment
          if (segIndex > 0 && segments[segIndex - 1].type === "land") {
            const landSeg = segments[segIndex - 1];
            const lastLandPoint = landSeg.points[landSeg.points.length - 1];
            pointsToUse = [lastLandPoint.point, ...pointsToUse];
          } else if (segIndex === 0) {
            // First segment is sea - extend to left edge
            const firstPoint = seg.points[0];
            pointsToUse = [`0,${firstPoint.yVal}`, ...pointsToUse];
          }
          // Check if there's a land segment after this sea segment
          if (segIndex < segments.length - 1 && segments[segIndex + 1].type === "land") {
            const landSeg = segments[segIndex + 1];
            const firstLandPoint = landSeg.points[0];
            pointsToUse = [...pointsToUse, firstLandPoint.point];
          } else if (segIndex === segments.length - 1) {
            // Last segment is sea - extend to right edge
            const lastPoint = seg.points[seg.points.length - 1];
            pointsToUse = [...pointsToUse, `${svgWidth},${lastPoint.yVal}`];
          }
        }
        const polyline = document.createElementNS(svgNS, "polyline");
        polyline.setAttribute("fill", "none");
        polyline.setAttribute("points", pointsToUse.join(" "));
        polyline.setAttribute("opacity", opacity);
        if (seg.type === "land") {
          polyline.setAttribute("stroke", landLineColor);
          polyline.setAttribute("stroke-width", landLineWidth);
        } else {
          polyline.setAttribute("stroke", seaLineColor);
          polyline.setAttribute("stroke-width", seaLineWidth);
        }
        polyline.dataset.row = y;
        polyline.dataset.segment = segIndex;
        polyline.dataset.type = seg.type;
        $(".lines").append(polyline);
      }
    });
  }
}


function populateCells() {
  placeWaterBg();
  for ( let row = coast.elevationMap.length-2; row > -1 ; row-- ) {
    for ( let column = coast.elevationMap.length-2; column > -1 ; column-- ) {
      cells.push( new Cell([row,column]) ); 
    }
  } 
}


function populateSVG() {
  if ( svgStyle == "lines" ) {
    populateLines();
  } else if ( svgStyle == "cells") {
    populateCells();
  }
}


function placeWaterBg() {
  let gs = coast.gridSize;
  let polygon = document.createElementNS( svgNS, "polygon" );
  polygon.setAttribute( "points", `0,${gs*0.5-seaLevel} ${gs},${gs*0.5-seaLevel} ${gs},${gs*1.5} 0,${gs*1.5}` );
  polygon.setAttribute( "fill", waterColor );
  polygon.setAttribute( "id", "water-bg" );
  document.querySelector("svg .cells").appendChild( polygon );
}


function setColors() {
  landColorBase = "rgb(200, 150, 100)";
  colors.baseR = landColorBase.split("(")[1].replace(")","").split(",")[0];
  colors.baseG = landColorBase.split("(")[1].replace(")","").split(",")[1];
  colors.baseB = landColorBase.split("(")[1].replace(")","").split(",")[2];
  colors.darkR = maxDark.split("(")[1].replace(")","").split(",")[0];
  colors.darkG = maxDark.split("(")[1].replace(")","").split(",")[1];
  colors.darkB = maxDark.split("(")[1].replace(")","").split(",")[2];
  colors.lightR = maxLight.split("(")[1].replace(")","").split(",")[0];
  colors.lightG = maxLight.split("(")[1].replace(")","").split(",")[1];
  colors.lightB = maxLight.split("(")[1].replace(")","").split(",")[2];
}


function getFillColor( height ) {
  let resultR, resultG, resultB;
  let minHeight = coast.gridSize / (coast.elevationMap.length-1) * -.5;
  let maxHeight = coast.gridSize / (coast.elevationMap.length-1) * 9;
  let midHeight = maxHeight/2;
  if ( height > midHeight ) {
    resultR = colors.baseR + ((height-midHeight)*(colors.lightR-colors.baseR)/(maxHeight-midHeight));
    resultG = colors.baseG + ((height-midHeight)*(colors.lightG-colors.baseG)/(maxHeight-midHeight));
    resultB = colors.baseB + ((height-midHeight)*(colors.lightB-colors.baseB)/(maxHeight-midHeight));
  } else {
    resultR = colors.darkR + ((height-minHeight)*(colors.baseR-colors.darkR)/(midHeight-minHeight));
    resultG = colors.darkG + ((height-minHeight)*(colors.baseG-colors.darkG)/(midHeight-minHeight));
    resultB = colors.darkB + ((height-minHeight)*(colors.baseB-colors.darkB)/(midHeight-minHeight));
  }
  return `rgb(${resultR},${resultG},${resultB})`;
}


function regenerate() {
  $(".lines, .cells").empty();
  pauseTide();
  seaLevel = seaLevelInit; 
  init();
}


function downloadSVG() {
  const svg = document.querySelector("svg.image");
  const svgData = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  const downloadLink = document.createElement("a");
  downloadLink.href = svgUrl;
  downloadLink.download = `generative-coast-${seed}.svg`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(svgUrl);
}


function downloadPNG() {
  const svg = document.querySelector("svg.image");
  const svgClone = svg.cloneNode(true);
  const svgData = new XMLSerializer().serializeToString(svgClone);
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = function() {
    const canvas = document.createElement("canvas");
    const viewBox = svg.getAttribute("viewBox").split(" ");
    canvas.width = parseInt(viewBox[2]);
    canvas.height = parseInt(viewBox[3]);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    canvas.toBlob(function(blob) {
      const pngUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `generative-coast-${coast.seed}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(pngUrl);
      URL.revokeObjectURL(svgUrl);
    });
  };
  img.src = svgUrl;
}




function setListeners() {
  
  $(".button.regenerate").on( "click", regenerate );
  $(".button.tide").on( "click", toggleTide );
  $(".button.reverse-tide").on( "click", reverseTideDirection );
  $(".button.download-svg").on( "click", downloadSVG );
  $(".button.download-png").on( "click", downloadPNG );
  
}





$( ()=> {
  
  setListeners();
  init();
  
});