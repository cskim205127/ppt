import React from "react";
import ReactDOMServer from "react-dom/server";
import sharp from "sharp";
import * as Fa from "react-icons/fa";

function renderIconSvg(IconComponent: any, color: string, size: number): string {
  return ReactDOMServer.renderToStaticMarkup(React.createElement(IconComponent, { color, size: String(size) }));
}

export async function iconToBase64Png(iconName: keyof typeof Fa, color: string, size = 256): Promise<string> {
  const IconComponent = Fa[iconName];
  if (!IconComponent) throw new Error("Missing icon: " + String(iconName));
  const svg = renderIconSvg(IconComponent, color, size);
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + pngBuffer.toString("base64");
}
