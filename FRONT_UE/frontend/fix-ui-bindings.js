const fs = require('fs');
const html = fs.readFileSync('C:\\Users\\a\\Desktop\\双创\\PROJECT\\FRONT_UE\\frontend\\SignallingWebServerNew\\player.htm', 'utf8');

let content = fs.readFileSync('C:\\Users\\a\\Desktop\\双创\\PROJECT\\FRONT_UE\\frontend\\SignallingWebServerNew\\scripts\\ui-bindings.js', 'utf8');

// The original player-custom.html used new IDs. Let's see what IDs exist.
if (!html.includes('id="signalling-url"')) {
    content = content.replace(/getElementById\('signalling-url'\)/g, "getElementById('socket-url')");
}
if (!html.includes('id="simulation-id"')) {
    content = content.replace(/getElementById\('simulation-id'\)/g, "getElementById('input-simulation-id')");
}

fs.writeFileSync('C:\\Users\\a\\Desktop\\双创\\PROJECT\\FRONT_UE\\frontend\\SignallingWebServerNew\\scripts\\ui-bindings.js', content, 'utf8');
console.log("ui-bindings fixed");
