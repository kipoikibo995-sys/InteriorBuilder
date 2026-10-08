// Shared drawing layer: the same template code draws to a canvas (preview) and to a PDF (jsPDF).
// Coordinates: inches, origin at the page's top-left. Line widths and font sizes: points (1/72 inch).
(function (global) {
  'use strict';

  const PT = 1 / 72;

  class CanvasPainter {
    constructor(ctx, scale, fontFamily) {
      this.ctx = ctx;
      this.s = scale; // pixels per inch
      this.fontFamily = fontFamily || 'Helvetica, Arial, sans-serif';
    }

    _stroke(o) {
      const c = this.ctx;
      c.lineWidth = Math.max((o.w || 0.5) * PT * this.s, 0.5);
      c.strokeStyle = o.color || '#000000';
      c.setLineDash(o.dash ? o.dash.map((d) => d * this.s) : []);
      c.lineCap = o.dash ? 'butt' : 'round';
    }

    line(x1, y1, x2, y2, o = {}) {
      const c = this.ctx, s = this.s;
      this._stroke(o);
      c.beginPath();
      c.moveTo(x1 * s, y1 * s);
      c.lineTo(x2 * s, y2 * s);
      c.stroke();
    }

    rect(x, y, w, h, o = {}) {
      const c = this.ctx, s = this.s;
      c.beginPath();
      if (o.radius) {
        c.roundRect(x * s, y * s, w * s, h * s, o.radius * s);
      } else {
        c.rect(x * s, y * s, w * s, h * s);
      }
      if (o.fill) {
        c.fillStyle = o.fill;
        c.fill();
      }
      if (o.stroke !== false) {
        this._stroke(o);
        c.stroke();
      }
    }

    circle(x, y, r, o = {}) {
      const c = this.ctx, s = this.s;
      c.beginPath();
      c.arc(x * s, y * s, r * s, 0, Math.PI * 2);
      if (o.fill) {
        c.fillStyle = o.fill;
        c.fill();
      }
      if (o.stroke) {
        this._stroke(o);
        c.stroke();
      }
    }

    text(str, x, y, o = {}) {
      const c = this.ctx, s = this.s;
      const size = (o.size || 10) * PT * s;
      c.font = `${o.bold ? 'bold ' : ''}${o.italic ? 'italic ' : ''}${size}px ${this.fontFamily}`;
      c.fillStyle = o.color || '#000000';
      c.textAlign = o.align || 'left';
      c.textBaseline = 'alphabetic';
      if (o.angle) {
        // o.angle: degrees, counter-clockwise (same as jsPDF).
        c.save();
        c.translate(x * s, y * s);
        c.rotate((-o.angle * Math.PI) / 180);
        c.fillText(str, 0, 0);
        c.restore();
      } else {
        c.fillText(str, x * s, y * s);
      }
    }

    dot(x, y, d, color) {
      const c = this.ctx, s = this.s;
      c.beginPath();
      c.arc(x * s, y * s, Math.max((d / 2) * s, 0.6), 0, Math.PI * 2);
      c.fillStyle = color || '#000000';
      c.fill();
    }

    image(img, x, y, w, h) {
      this.ctx.drawImage(img.el, x * this.s, y * this.s, w * this.s, h * this.s);
    }

    textWidth(str, o = {}) {
      const size = (o.size || 10) * PT * this.s;
      this.ctx.font = `${o.bold ? 'bold ' : ''}${size}px ${this.fontFamily}`;
      return this.ctx.measureText(str).width / this.s;
    }
  }

  class PdfPainter {
    // font: { name, custom } — custom = true for a user-uploaded TTF (normal style only).
    constructor(doc, font) {
      this.doc = doc;
      this.font = font || { name: 'helvetica', custom: false };
    }

    _color(c) {
      return c || '#000000';
    }

    _stroke(o) {
      const d = this.doc;
      d.setLineWidth((o.w || 0.5) * PT);
      d.setDrawColor(this._color(o.color));
      d.setLineCap(o.dash ? 'butt' : 'round');
      d.setLineDashPattern(o.dash || [], 0);
    }

    line(x1, y1, x2, y2, o = {}) {
      this._stroke(o);
      this.doc.line(x1, y1, x2, y2);
    }

    rect(x, y, w, h, o = {}) {
      const d = this.doc;
      let style = '';
      if (o.fill) {
        d.setFillColor(o.fill);
        style += 'F';
      }
      if (o.stroke !== false) {
        this._stroke(o);
        style = style ? 'FD' : 'S';
      }
      if (!style) return;
      if (o.radius) d.roundedRect(x, y, w, h, o.radius, o.radius, style);
      else d.rect(x, y, w, h, style);
    }

    circle(x, y, r, o = {}) {
      const d = this.doc;
      let style = '';
      if (o.fill) {
        d.setFillColor(o.fill);
        style = 'F';
      }
      if (o.stroke) {
        this._stroke(o);
        style = style ? 'FD' : 'S';
      }
      if (style) d.circle(x, y, r, style);
    }

    _setFont(o) {
      const d = this.doc;
      if (this.font.custom) {
        d.setFont(this.font.name, 'normal');
      } else {
        const style = o.bold && o.italic ? 'bolditalic' : o.bold ? 'bold' : o.italic ? 'italic' : 'normal';
        d.setFont(this.font.name, style);
      }
      d.setFontSize(o.size || 10);
    }

    text(str, x, y, o = {}) {
      const d = this.doc;
      this._setFont(o);
      d.setTextColor(this._color(o.color));
      const opt = { align: o.align || 'left', baseline: 'alphabetic' };
      if (o.angle) opt.angle = o.angle;
      d.text(String(str), x, y, opt);
    }

    // A dot is a zero-length line with a round cap: far lighter than circle() when drawing thousands of dots.
    dot(x, y, d, color) {
      const doc = this.doc;
      doc.setLineDashPattern([], 0);
      doc.setLineCap('round');
      doc.setLineWidth(d);
      doc.setDrawColor(color || '#000000');
      doc.line(x, y, x, y);
    }

    image(img, x, y, w, h) {
      this.doc.addImage(img.dataUrl, img.format, x, y, w, h, img.key, 'FAST');
    }

    textWidth(str, o = {}) {
      this._setFont(o);
      return this.doc.getTextWidth(String(str));
    }
  }

  global.CanvasPainter = CanvasPainter;
  global.PdfPainter = PdfPainter;
})(typeof window !== 'undefined' ? window : globalThis);
