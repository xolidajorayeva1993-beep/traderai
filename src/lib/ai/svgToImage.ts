// ============================================================
// SVG → PNG konvertatsiya (AI vision uchun)
// sharp kutubxonasi ishlatiladi
// ============================================================
import sharp from 'sharp'

/**
 * SVG string yoki data:image/svg+xml... URI ni PNG buffer ga aylantiradi
 * GPT-4o va Gemini vision uchun ishlatiladi
 */
export async function svgToPngBase64(svgInput: string): Promise<string | null> {
  try {
    let svgString: string

    if (svgInput.startsWith('data:image/svg+xml;base64,')) {
      svgString = Buffer.from(svgInput.slice('data:image/svg+xml;base64,'.length), 'base64').toString('utf-8')
    } else if (svgInput.startsWith('data:image/svg+xml;charset=utf-8,')) {
      svgString = decodeURIComponent(svgInput.slice('data:image/svg+xml;charset=utf-8,'.length))
    } else {
      svgString = svgInput
    }

    const pngBuffer = await sharp(Buffer.from(svgString))
      .png({ compressionLevel: 6 })
      .resize({ width: 2000, withoutEnlargement: true })
      .toBuffer()

    return pngBuffer.toString('base64')
  } catch {
    // SVG→PNG conversion failed — AI will proceed without image
    return null
  }
}
