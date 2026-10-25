# 最终图像生成提示词

工具：内置 `image_gen`，开启透明背景。四次调用都使用 `reference.png` 作为形象参考，生成文件为 `dog.png`、`mouse.png`、`owl.png`、`raccoon.png`。以下模板与角色参数构成最终提示词集合。

四次调用使用下列提示词模板，其中 IDENTITY 分别为：

- dog: the cream puppy in the TOP LEFT reference panel: cream fur, caramel floppy ears, white muzzle, dark oval nose, warm cocoa outline
- mouse: the lavender-gray mouse in the TOP RIGHT reference panel: very large round pink-lined ears, pink tiny nose, short whiskers, NO bubble tea in head portraits
- owl: the chestnut-brown owl in the BOTTOM LEFT reference panel: cream facial discs, swept feather tufts, PERMANENT ROUND BROWN GLASSES WITH BRIDGE on EVERY expression, golden triangular beak; NEVER puppy features
- raccoon: the cool-gray raccoon in the BOTTOM RIGHT reference panel: charcoal eye mask, cream muzzle, pointed softly rounded ears, playful knowing eyes

### 最终提示词模板（原文）

Generate ONE new transparent PNG expression sprite atlas featuring ONLY IDENTITY. The attached model sheet is the strict character identity/style reference, not the output layout. Preserve its original picture-book hand-drawn cocoa linework, pastel colors and restrained colored-pencil texture. Exactly NINE head-and-shoulder portraits of the SAME single animal. No other species. No lettering, labels, punctuation, symbols, frames, decoration or shadows. Actual alpha transparency outside all portraits.
CRITICAL PRODUCTION GEOMETRY: square canvas, EXACTLY 3 equal columns and 3 equal rows. ONE portrait centered in EACH of nine equal square cells. The entire character INCLUDING EARS, WHISKERS, FEATHER TUFTS and any greeting paw must fit inside the CENTRAL SIXTY PERCENT of its cell, leaving a CLEAR EMPTY TRANSPARENT BORDER OF TWENTY PERCENT on EVERY edge of EVERY cell. Make the characters noticeably SMALL, not filling the canvas. At 1200 pixels wide, each cell is 400x400 and each portrait must be NO WIDER THAN 240 pixels and NO TALLER THAN 240 pixels. Huge transparent gutters between the nine portraits are intentional and ESSENTIAL for software cropping. No touching, no overlaps, no stray fur or body fragments in any gutter. Portrait size, identity, eye spacing and baseline must remain consistent. Do not fill the empty space.
Ordering reading left to right, top to bottom: row1 NORMAL attentive gentle closed mouth; HAPPY delighted eyes and smile; WAVE friendly greeting with small raised paw/wing. Row2 SMIRK playful asymmetric knowing smile; SLEEPY drooping eyelids and a tiny yawn (owl MUST still have brown feathers, beak and round spectacles); ANGRY mild child-friendly knitted brows and frown. Row3 SURPRISE wide eyes and O mouth; TALK open speaking mouth/beak with attentive eyes; THINK sideways gaze and subtly raised brow. All are clearly distinct expressions of the SAME reference character. No full bodies. Keep clean neck/shoulder endings contained in each portrait. Matching the exact 3x3 geometry with large transparent gutters takes priority over filling the image. No props except the owl's permanent glasses.
