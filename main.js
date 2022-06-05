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

  getSprite(yyFile) {
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
          'sprites/' + yyFile.name + '/' + spriteFile,
        );
        console.log(yy);
        return {
          url: sprite,
          offset: { x: 0, y: 0 },
        };
      }
      case 'GMTileSet': {
        return this.getSprite(yy.spriteId);
      }
    }
  }

  render() {
    this.canvas.width = this.file.roomSettings.Width;
    this.canvas.height = this.file.roomSettings.Height;
    this.file.layers.reverse().forEach((layer) => {
      switch (layer.resourceType) {
        case 'GMRInstanceLayer': {
          layer.instances.forEach((instance) => {
            const sprite = new Image();
            const spr = this.getSprite(instance.objectId);
            sprite.src = spr.url;
            sprite.onload = () => {
              this.context.drawImage(
                sprite,
                instance.x - spr.offset.x,
                instance.y - spr.offset.y,
                instance.scaleX * sprite.width,
                instance.scaleY * sprite.height,
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
          const tileset = new Image();
          const spr = this.getSprite(layer.tilesetId);
          tileset.src = spr.url;
          tileset.onload = () => {
            const tile_width = 16; //layer.tiles.SerialiseWidth;
            const tile_height = 16; //layer.tiles.SerialiseHeight;
            const tiles = layer.tiles.TileSerialiseData;
            const all_tiles = Math.floor(
              (tileset.width / tile_width) * (tileset.height / tile_height),
            );
            let tile_id = 0;
            for (let y = 0; y < this.canvas.height / tile_height; y++) {
              for (let x = 0; x < this.canvas.width / tile_width; x++) {
                const brushId = tiles[tile_id];
                tile_id++;
                //if (brushId == 0 || brushId == 2147483648) continue;
                const brush_x = brushId % all_tiles;
                const brush_y = brushId / all_tiles;
                this.context.drawImage(
                  tileset,
                  brush_x * tile_width,
                  brush_y,
                  tile_width,
                  tile_height,
                  layer.x + x * tile_width,
                  layer.y + y * tile_height,
                  tile_width,
                  tile_height,
                );
              }
            }
            console.log(layer);
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
