import sharp from 'sharp'

const src = new URL('../public/icons/icon.svg', import.meta.url).pathname
for (const size of [192, 512]) {
  const out = new URL(`../public/icons/icon-${size}.png`, import.meta.url).pathname
  await sharp(src).resize(size, size).png().toFile(out)
  console.log(out)
}
