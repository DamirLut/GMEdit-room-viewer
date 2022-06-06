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
    this.element.appendChild(this.pannerRoot);
    this.render();
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

    this.file.layers.reverse().forEach((layer) => {
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
          console.log(layer);
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
              if (brush_id == 0 || brush_id == VOID_TILE) continue;

              if (brush_id > TileBit_Mask) {
                brush_id = brush_id & TileBit_Mask;
              }

              const x = (i % grid_x) * tile_width;
              const y = Math.floor(i / grid_x) * tile_height;

              const brush_x = (brush_id / spr.tile_count) * tile_width;
              const brush_y = brush_id % spr.tile_count;

              this.context.drawImage(
                tileset,
                brush_x,
                brush_y,
                tile_width,
                tile_height,
                layer.x + x,
                layer.y + y,
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
