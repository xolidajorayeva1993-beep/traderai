// ============================================================
// SVG → base64 konvertatsiya (AI vision va frontend uchun)
// sharp ishlatilmaydi — Cloud Run (Linux) da native binary muammosi bor.
// SVG to'g'ridan base64 ga aylantiriladi.
// Frontend: data:image/svg+xml;base64,{result}
// ============================================================

/**
 * SVG string yoki data:image/svg+xml... URI ni SVG base64 ga aylantiradi
 * GPT-4o va Gemini vision uchun ishlatiladi
 */
export async function svgToPngBase64(svgInput: string): Promise<string | null> {
  try {
    let svgString: string

    if (svgInput.startsWith('data:image/svg+xml;base64,')) {
      // Already base64 encoded SVG — decode to get raw SVG string
      svgString = Buffer.from(
        svgInput.slice('data:image/svg+xml;base64,'.length),
        'base64'
      ).toString('utf-8')
    } else if (svgInput.startsWith('data:image/svg+xml;charset=utf-8,')) {
      svgString = decodeURIComponent(
        svgInput.slice('data:image/svg+xml;charset=utf-8,'.length)
      )
    } else {
      svgString = svgInput
    }

    // SVG ni base64 ga aylantiramiz (frontend data:image/svg+xml;base64,... ishlatadi)
    return Buffer.from(svgString, 'utf-8').toString('base64')
  } catch {
    // Conversion failed — AI will proceed without image
    return null
  }
}
