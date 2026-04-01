const fs = require('fs');
let html = fs.readFileSync('PROJECT/FRONT_UE/frontend/WebServers/SignallingWebServer/www/player-utf8.html', 'utf8');

html = html.replace('数字孪生地铁灾害应急仿真系\ufffd?/title>', '数字孪生地铁灾害应急仿真系统</title>');
html = html.replace('仿真控制\ufffd?/div>', '仿真控制台</div>');
html = html.replace('大模型预\ufffd?/span>', '大模型预案</span>');
html = html.replace('等待UE像素流连\ufffd?..', '等待UE像素流连接...');
html = html.replace('总人\ufffd?/div>', '总人数</div>');
html = html.replace('受影响人\ufffd?/div>', '受影响人数</div>');
html = html.replace('受影响程\ufffd?/div>', '受影响程度</div>');
html = html.replace('连接所\ufffd?/button>', '连接所有</button>');
html = html.replace('1\ufffd?/option>', '1s</option>');
html = html.replace('5\ufffd?/option>', '5s</option>');
html = html.replace('10\ufffd?/option>', '10s</option>');
html = html.replace('大模型预案设\ufffd?/div>', '大模型预案设定</div>');
html = html.replace('生成并应用预\ufffd?/button>', '生成并应用预案</button>');
html = html.replace(/浼樺寲鐤忔暎鏁堢巼/g, '优化疏散效率');
html = html.replace('type="button">\ufffd?</button>', 'type="button">≡</button>'); // First button is sidebar toggle
html = html.replace('type="button">\ufffd?</button>', 'type="button">×</button>'); // Next button is close-create
html = html.replace('type="button">\ufffd?</button>', 'type="button">×</button>'); // Last button is close-plan

html = html.replace(/\[Dependency\] \ufffd\?/g, '[Dependency] *');

fs.writeFileSync('PROJECT/FRONT_UE/frontend/WebServers/SignallingWebServer/www/player.html', html, 'utf8');
console.log('Fixed player.html successfully!');
