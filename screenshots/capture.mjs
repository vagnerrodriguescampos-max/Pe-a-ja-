import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 800 });

// 1. Cardápio
await page.goto('http://localhost:3000/loja/shawarma-da-nanda', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: 'screenshots/01-cardapio.png' });
console.log('1. cardapio ok');

// 2. Chat widget - clicar no botão flutuante (último botão da página)
const btns = await page.locator('button').all();
// O botão do chat é o último botão na página (fixed bottom-right)
const chatBtn = page.locator('div.fixed.bottom-6.right-6 button').last();
await chatBtn.click();
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/02-chat-widget-ident.png' });
console.log('2. chat widget ok');

// 3. Admin login
await page.goto('http://localhost:3000/admin/login', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/03-admin-login.png' });
console.log('3. login ok');

// 4. Fazer login
await page.fill('input[type="email"]', 'admin@shawarma.com');
await page.fill('input[type="password"]', 'admin123');
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);
await page.screenshot({ path: 'screenshots/04-admin-pedidos.png' });
console.log('4. admin pedidos ok');

// 5. Chat admin inbox
await page.goto('http://localhost:3000/admin/chat', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/05-admin-chat.png' });
console.log('5. admin chat ok');

// 6. Dashboard
await page.goto('http://localhost:3000/admin/dashboard', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.screenshot({ path: 'screenshots/06-admin-dashboard.png' });
console.log('6. dashboard ok');

// 7. Clientes
await page.goto('http://localhost:3000/admin/clientes', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/07-admin-clientes.png' });
console.log('7. clientes ok');

await browser.close();
console.log('Todas screenshots capturadas.');
