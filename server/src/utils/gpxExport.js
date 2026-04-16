function geojsonToGpx(geojson, name) {
  const tracks = geojson.features
    .filter((f) => f.geometry && f.geometry.type === 'LineString')
    .map((f) => {
      const points = f.geometry.coordinates
        .map(([lon, lat, ele]) => {
          const elTag = ele != null ? `<ele>${ele}</ele>` : '';
          return `      <trkpt lat="${lat}" lon="${lon}">${elTag}</trkpt>`;
        })
        .join('\n');
      const trkName = f.properties?.name || name;
      return `  <trk>\n    <name>${trkName}</name>\n    <trkseg>\n${points}\n    </trkseg>\n  </trk>`;
    });

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Trackmapgic" xmlns="http://www.topografix.com/GPX/1/1">
${tracks.join('\n')}
</gpx>`;
}

module.exports = { geojsonToGpx };
