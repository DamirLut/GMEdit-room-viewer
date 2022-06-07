// @ts-nocheck

const fs = require('fs');
const path = require('path');
var PluginState;

class KYyRoom extends $gmedit['file.FileKind'] {
  constructor() {
    super();
  }
  init(file) {
    let data = fs.readFileSync(file.path, 'utf-8');
    data = $gmedit['yy.YyJson'].parse(data);
    file.editor = new RoomEditor(data);
  }
}

class RoomEditor extends $gmedit['editors.Editor'] {
  constructor(file) {
    super(file);
    this.file = file;
    this.element = document.createElement('div');
    this.element.id = 'room-editor';
    this.pannerRoot = document.createElement('div');
    this.pannerRoot.style.height = '100%';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'IMG';
    this.canvas.imageSmoothingEnabled = false;
    this.canvas.style.imageRendering = 'pixelated';
    this.context = this.canvas.getContext('2d');
    this.pannerRoot.appendChild(this.canvas);
    this.panner = new $gmedit['editors.Panner'](this.pannerRoot, this.canvas);
    this.editor = document.createElement('div');
    this.element.appendChild(this.editor);
    this.element.appendChild(this.pannerRoot);
    this.layers = new Map();
    this.buildHtml();
    this.render();
  }

  buildHtml() {
    this.editor.classList.add('room-options');
    this.editor.innerHTML = /*html*/ `
      <div style="display: flex; flex-direction: column;">
        <label>Width</label>
        <input type="number" readonly value="${this.file.roomSettings.Width}"/>
        <label>Height</label>
        <input type="number" readonly value="${this.file.roomSettings.Height}"/>
      </div>
      <hr />
    `;
    this.layersList = document.createElement('div');
    this.layersList.classList.add('layers-list');
    this.file.layers.forEach((layer) => {
      this.layers.set(layer.depth, true);
      const div = document.createElement('div');
      div.classList.add('one-line');
      div.innerHTML = /*html*/ `
        <input checked="true" type="checkbox" id="layer-${layer.depth}"/>
        <label for="layer-${layer.depth}">${layer.name}</label>
    `;
      this.layersList.appendChild(div);
      div.addEventListener('click', (e) => {
        if (e.target.id != '') {
          this.layers.set(layer.depth, div.children[0].checked);
          this.render();
        }
      });
    });
    this.editor.appendChild(this.layersList);
  }

  getSprite(yyFile, folder = 'sprites', name) {
    if (name) {
      return $gmedit['gml.Project'].current.getImageURL(
        folder + '/' + yyFile + '/' + name + '.png',
      );
    }
    const yy = $gmedit['electron.FileWrap'].readYyFileSync(yyFile.path);
    switch (yy.resourceType) {
      case 'GMObject': {
        if (yy.spriteId != null) {
          return this.getSprite(yy.spriteId);
        }
        return {
          url: path.join(PluginState.dir, 'icons', 'icon_roomeditor_nosprite.png'),
          offset: { x: 0, y: 0 },
        };
      }
      case 'GMSprite': {
        const spriteFile = yy.frames[0].images[0].FrameId.name + '.png';

        const sprite = $gmedit['gml.Project'].current.getImageURL(
          folder + '/' + yyFile.name + '/' + spriteFile,
        );

        return {
          url: sprite,
          offset: { x: yy.sequence.xorigin, y: yy.sequence.yorigin },
        };
      }
      case 'GMTileSet': {
        return {
          url: this.getSprite(yyFile.name, 'tilesets', 'output_tileset'),
          border: {
            width: yyFile.out_tilewborder,
            height: yyFile.out_tilehborder,
          },
          tile_count: yy.tile_count,
          size: {
            width: yy.tileWidth,
            height: yy.tileHeight,
          },
          offset: {
            x: 0,
            y: 0,
          },
        };
      }
    }
  }

  drawSprite(image, x = 0, y = 0, rotate = 0, xscale = 1, yscale = 1) {
    this.context.save();
    this.context.translate(x, y);
    this.context.rotate(rotate);
    this.context.scale(xscale, yscale);
    this.context.drawImage(image, 0, 0);
    this.context.restore();
  }
  drawSpritePart(
    image,
    x = 0,
    y = 0,
    rotate = 0,
    xscale = 1,
    yscale = 1,
    left_x,
    top_y,
    width,
    height,
  ) {
    this.context.save();
    this.context.translate(x, y);
    this.context.rotate(rotate);
    this.context.scale(xscale, yscale);
    this.context.drawImage(image, left_x, top_y, width, height, 0, 0, width, height);
    this.context.restore();
  }

  render() {
    this.canvas.width = this.file.roomSettings.Width;
    this.canvas.height = this.file.roomSettings.Height;

    const VOID_TILE = 2147483648;
    const TileBit_Mask = 524287;
    const TileBit_Flip = 29;
    const TileBit_Mirror = 28;
    const TileBit_Rotate90 = 30;

    const checkBits = (value, bits) => (value & bits) == bits;
    const isTileFlipped = (index) => checkBits(index, TileBit_Flip);
    const isTileMirror = (index) => checkBits(index, TileBit_Mirror);
    const isTileRotate90 = (index) => checkBits(index, TileBit_Rotate90);

    this.file.layers
      .sort((prev, next) => next.depth - prev.depth)
      .forEach((layer) => {
        if (this.layers.get(layer.depth) == false) return;
        switch (layer.resourceType) {
          case 'GMRInstanceLayer': {
            layer.instances.forEach((instance) => {
              const sprite = new Image();
              const spr = this.getSprite(instance.objectId);
              sprite.src = spr.url;
              sprite.onload = () => {
                this.drawSprite(
                  sprite,
                  instance.x - spr.offset.x,
                  instance.y - spr.offset.y,
                  0,
                  instance.scaleX,
                  instance.scaleY,
                );
              };
            });
            break;
          }
          case 'GMRBackgroundLayer': {
            if (layer.spriteId == null) {
              const r = layer.colour & 0xff;
              const g = (layer.colour & 0xff00) >> 8;
              const b = (layer.colour & 0xff0000) >> 16;
              this.context.fillStyle = `rgb(${r},${g},${b})`;
              this.context.fillRect(layer.x, layer.y, this.canvas.width, this.canvas.height);

              return;
            }
            const background = new Image();
            const spr = this.getSprite(layer.spriteId);
            background.src = spr.url;
            background.onload = () => {
              if (layer.stretch) {
                this.context.drawImage(
                  background,
                  layer.x,
                  layer.y,
                  this.canvas.width,
                  this.canvas.height,
                );
              }
              if (layer.vtiled && layer.htiled) {
                const cells_x = this.canvas.width / background.width;
                const cells_y = this.canvas.height / background.height;
                for (let x = 0; x < cells_x; x++) {
                  for (let y = 0; y < cells_y; y++) {
                    this.context.drawImage(
                      background,
                      layer.x + x * background.width,
                      layer.y + y * background.height,
                    );
                  }
                }
              }
            };
            break;
          }
          case 'GMRTileLayer': {
            const tileset = new Image();
            const spr = this.getSprite(layer.tilesetId);
            tileset.src = spr.url;

            tileset.onload = () => {
              const grid_x = layer.tiles.SerialiseWidth;
              const grid_y = layer.tiles.SerialiseHeight;
              const tile_width = spr.size.width;
              const tile_height = spr.size.height;
              const tiles = layer.tiles.TileSerialiseData;
              for (let i = 0; i < tiles.length; i++) {
                let brush_id = tiles[i];
                if (brush_id > TileBit_Mask) {
                  brush_id = brush_id & TileBit_Mask;
                }
                if (brush_id == 0 || brush_id == VOID_TILE) continue;

                const x = i % grid_x;
                const y = Math.floor(i / grid_x);
                const brush_x = brush_id % (tile_width - 1);
                const brush_y = Math.floor(brush_id / (tile_width - 1));
                var scaleX = tiles[i] >> TileBit_Mirror ? -1 : 1;
                var scaleY = tiles[i] >> TileBit_Flip ? -1 : 1;
                this.drawSpritePart(
                  tileset,
                  layer.x + x * tile_width,
                  layer.y + y * tile_width + (scaleY == -1 ? 16 : 0),
                  0,
                  scaleX,
                  scaleY,
                  brush_x * tile_width,
                  brush_y * tile_width,
                  tile_width,
                  tile_height,
                );
              }
            };
            break;
          }
          default: {
            //console.log(layer);
          }
        }
      });
  }
}

GMEdit.register('room-viewer', {
  init: (state) => {
    PluginState = state;
    $gmedit['file.kind.KYy'].register('GMRoom', new KYyRoom());
  },
});
