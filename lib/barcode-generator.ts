// Enhanced barcode generation with industry standards for driver scanners
export interface BarcodeConfig {
  format: "CODE128" | "CODE39" | "EAN13" | "DATAMATRIX" | "PDF417"
  width: number
  height: number
  displayValue: boolean
  fontSize: number
  textAlign: "left" | "center" | "right"
  textPosition: "bottom" | "top"
  background: string
  lineColor: string
  margin: number
  marginTop?: number
  marginBottom?: number
  marginLeft?: number
  marginRight?: number
  quiet: number // Quiet zone
}

export const defaultBarcodeConfig: BarcodeConfig = {
  format: "CODE128",
  width: 2,
  height: 100,
  displayValue: true,
  fontSize: 12,
  textAlign: "center",
  textPosition: "bottom",
  background: "#FFFFFF",
  lineColor: "#000000",
  margin: 10,
  quiet: 10,
}

// Industry-standard barcode configurations for different use cases
export const BARCODE_PRESETS = {
  SHIPPING_LABEL: {
    ...defaultBarcodeConfig,
    format: "CODE128" as const,
    width: 2,
    height: 80,
    fontSize: 10,
    margin: 5,
    quiet: 10,
  },
  PACKAGE_TRACKING: {
    ...defaultBarcodeConfig,
    format: "CODE128" as const,
    width: 3,
    height: 100,
    fontSize: 12,
    margin: 8,
    quiet: 12,
  },
  MOBILE_SCANNER: {
    ...defaultBarcodeConfig,
    format: "CODE128" as const,
    width: 4,
    height: 120,
    fontSize: 14,
    margin: 10,
    quiet: 15,
  },
  HIGH_DENSITY: {
    ...defaultBarcodeConfig,
    format: "DATAMATRIX" as const,
    width: 6,
    height: 6,
    fontSize: 8,
    margin: 4,
    quiet: 2,
  },
}

// CODE128 character set mappings
const CODE128_CHARSET = {
  A: {
    " ": 0,
    "!": 1,
    '"': 2,
    "#": 3,
    $: 4,
    "%": 5,
    "&": 6,
    "'": 7,
    "(": 8,
    ")": 9,
    "*": 10,
    "+": 11,
    ",": 12,
    "-": 13,
    ".": 14,
    "/": 15,
    "0": 16,
    "1": 17,
    "2": 18,
    "3": 19,
    "4": 20,
    "5": 21,
    "6": 22,
    "7": 23,
    "8": 24,
    "9": 25,
    ":": 26,
    ";": 27,
    "<": 28,
    "=": 29,
    ">": 30,
    "?": 31,
    "@": 32,
    A: 33,
    B: 34,
    C: 35,
    D: 36,
    E: 37,
    F: 38,
    G: 39,
    H: 40,
    I: 41,
    J: 42,
    K: 43,
    L: 44,
    M: 45,
    N: 46,
    O: 47,
    P: 48,
    Q: 49,
    R: 50,
    S: 51,
    T: 52,
    U: 53,
    V: 54,
    W: 55,
    X: 56,
    Y: 57,
    Z: 58,
    "[": 59,
    "\\": 60,
    "]": 61,
    "^": 62,
    _: 63,
  },
  B: {
    " ": 0,
    "!": 1,
    '"': 2,
    "#": 3,
    $: 4,
    "%": 5,
    "&": 6,
    "'": 7,
    "(": 8,
    ")": 9,
    "*": 10,
    "+": 11,
    ",": 12,
    "-": 13,
    ".": 14,
    "/": 15,
    "0": 16,
    "1": 17,
    "2": 18,
    "3": 19,
    "4": 20,
    "5": 21,
    "6": 22,
    "7": 23,
    "8": 24,
    "9": 25,
    ":": 26,
    ";": 27,
    "<": 28,
    "=": 29,
    ">": 30,
    "?": 31,
    "@": 32,
    A: 33,
    B: 34,
    C: 35,
    D: 36,
    E: 37,
    F: 38,
    G: 39,
    H: 40,
    I: 41,
    J: 42,
    K: 43,
    L: 44,
    M: 45,
    N: 46,
    O: 47,
    P: 48,
    Q: 49,
    R: 50,
    S: 51,
    T: 52,
    U: 53,
    V: 54,
    W: 55,
    X: 56,
    Y: 57,
    Z: 58,
    "[": 59,
    "\\": 60,
    "]": 61,
    "^": 62,
    _: 63,
    "`": 64,
    a: 65,
    b: 66,
    c: 67,
    d: 68,
    e: 69,
    f: 70,
    g: 71,
    h: 72,
    i: 73,
    j: 74,
    k: 75,
    l: 76,
    m: 77,
    n: 78,
    o: 79,
    p: 80,
    q: 81,
    r: 82,
    s: 83,
    t: 84,
    u: 85,
    v: 86,
    w: 87,
    x: 88,
    y: 89,
    z: 90,
    "{": 91,
    "|": 92,
    "}": 93,
    "~": 94,
    DEL: 95,
  },
}

// CODE128 bar patterns (each character is represented by 11 bars)
const CODE128_PATTERNS = [
  "11011001100",
  "11001101100",
  "11001100110",
  "10010011000",
  "10010001100",
  "10001001100",
  "10011001000",
  "10011000100",
  "10001100100",
  "11001001000",
  "11001000100",
  "11000100100",
  "10110011100",
  "10011011100",
  "10011001110",
  "10111001100",
  "10011101100",
  "10011100110",
  "11001110010",
  "11001011100",
  "11001001110",
  "11011100100",
  "11001110100",
  "11101101110",
  "11101001100",
  "11100101100",
  "11100100110",
  "11101100100",
  "11100110100",
  "11100110010",
  "11011011000",
  "11011000110",
  "11000110110",
  "10100011000",
  "10001011000",
  "10001000110",
  "10110001000",
  "10001101000",
  "10001100010",
  "11010001000",
  "11000101000",
  "11000100010",
  "10110111000",
  "10110001110",
  "10001101110",
  "10111011000",
  "10111000110",
  "10001110110",
  "11101110110",
  "11010001110",
  "11000101110",
  "11011101000",
  "11011100010",
  "11011101110",
  "11101011000",
  "11101000110",
  "11100010110",
  "11101101000",
  "11101100010",
  "11100011010",
  "11101111010",
  "11001000010",
  "11110001010",
  "10100110000",
  "10100001100",
  "10010110000",
  "10010000110",
  "10000101100",
  "10000100110",
  "10110010000",
  "10110000100",
  "10011010000",
  "10011000010",
  "10000110100",
  "10000110010",
  "11000010010",
  "11001010000",
  "11110111010",
  "11000010100",
  "10001111010",
  "10100111100",
  "10010111100",
  "10010011110",
  "10111100100",
  "10011110100",
  "10011110010",
  "11110100100",
  "11110010100",
  "11110010010",
  "11011011110",
  "11011110110",
  "11110110110",
  "10101111000",
  "10100011110",
  "10001011110",
  "10111101000",
  "10111100010",
  "11110101000",
  "11110100010",
  "10111011110",
  "10111101110",
  "11101011110",
  "11110101110",
  "11010000100",
  "11010010000",
  "11010011100",
  "1100011101011",
]

// Generate CODE128 barcode
export function generateCODE128Barcode(text: string, config: BarcodeConfig = defaultBarcodeConfig): string {
  if (!text || text.length === 0) {
    throw new Error("Text cannot be empty for barcode generation")
  }

  // Validate text for CODE128
  const validChars = /^[\x00-\x7F]*$/
  if (!validChars.test(text)) {
    throw new Error("Invalid characters for CODE128 barcode")
  }

  try {
    // Start with Code B (most common for alphanumeric)
    const encoded = [104] // Start B
    let checksum = 104

    // Encode each character
    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      const value = CODE128_CHARSET.B[char as keyof typeof CODE128_CHARSET.B]

      if (value === undefined) {
        throw new Error(`Character '${char}' not supported in CODE128`)
      }

      encoded.push(value)
      checksum += value * (i + 1)
    }

    // Add checksum
    encoded.push(checksum % 103)

    // Add stop pattern
    encoded.push(106)

    // Convert to bar pattern
    let pattern = ""
    for (const code of encoded) {
      pattern += CODE128_PATTERNS[code]
    }

    // Add final bar
    pattern += "11"

    return pattern
  } catch (error) {
    console.error("Error generating CODE128 barcode:", error)
    throw new Error("Failed to generate barcode")
  }
}

// Generate SVG barcode for high-quality output
export function generateBarcodeAsSVG(text: string, config: BarcodeConfig = defaultBarcodeConfig): string {
  const pattern = generateCODE128Barcode(text, config)

  const totalWidth = pattern.length * config.width + config.margin * 2
  const totalHeight = config.height + config.margin * 2 + (config.displayValue ? config.fontSize + 10 : 0)

  let svg = `<svg width="${totalWidth}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">`

  // Background
  svg += `<rect width="${totalWidth}" height="${totalHeight}" fill="${config.background}"/>`

  // Quiet zone
  svg += `<rect x="0" y="0" width="${config.quiet}" height="${totalHeight}" fill="${config.background}"/>`
  svg += `<rect x="${totalWidth - config.quiet}" y="0" width="${config.quiet}" height="${totalHeight}" fill="${config.background}"/>`

  // Bars
  let x = config.margin + config.quiet
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === "1") {
      svg += `<rect x="${x}" y="${config.margin}" width="${config.width}" height="${config.height}" fill="${config.lineColor}"/>`
    }
    x += config.width
  }

  // Text
  if (config.displayValue) {
    const textY =
      config.textPosition === "bottom" ? config.margin + config.height + config.fontSize + 5 : config.fontSize + 5

    svg += `<text x="${totalWidth / 2}" y="${textY}" font-family="monospace" font-size="${config.fontSize}" text-anchor="middle" fill="${config.lineColor}">${text}</text>`
  }

  svg += "</svg>"
  return svg
}

// Generate barcode as data URL for immediate use
export function generateBarcodeAsDataURL(text: string, config: BarcodeConfig = defaultBarcodeConfig): string {
  const svg = generateBarcodeAsSVG(text, config)
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

// Generate barcode as Canvas for high-resolution output
export function generateBarcodeAsCanvas(text: string, config: BarcodeConfig = defaultBarcodeConfig): HTMLCanvasElement {
  const pattern = generateCODE128Barcode(text, config)

  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")

  if (!ctx) {
    throw new Error("Could not get canvas context")
  }

  const totalWidth = pattern.length * config.width + config.margin * 2 + config.quiet * 2
  const totalHeight = config.height + config.margin * 2 + (config.displayValue ? config.fontSize + 10 : 0)

  // Set high DPI for better quality
  const dpr = window.devicePixelRatio || 1
  canvas.width = totalWidth * dpr
  canvas.height = totalHeight * dpr
  canvas.style.width = `${totalWidth}px`
  canvas.style.height = `${totalHeight}px`

  ctx.scale(dpr, dpr)

  // Background
  ctx.fillStyle = config.background
  ctx.fillRect(0, 0, totalWidth, totalHeight)

  // Bars
  ctx.fillStyle = config.lineColor
  let x = config.margin + config.quiet

  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === "1") {
      ctx.fillRect(x, config.margin, config.width, config.height)
    }
    x += config.width
  }

  // Text
  if (config.displayValue) {
    ctx.fillStyle = config.lineColor
    ctx.font = `${config.fontSize}px monospace`
    ctx.textAlign = config.textAlign

    const textX =
      config.textAlign === "center"
        ? totalWidth / 2
        : config.textAlign === "right"
          ? totalWidth - config.margin
          : config.margin

    const textY =
      config.textPosition === "bottom" ? config.margin + config.height + config.fontSize + 5 : config.fontSize + 5

    ctx.fillText(text, textX, textY)
  }

  return canvas
}

// Generate barcode as PNG data URL for PDF compatibility
export function generateBarcodeAsPNG(text: string, config: BarcodeConfig = defaultBarcodeConfig): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = generateBarcodeAsCanvas(text, config)

      // Convert canvas to PNG
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Failed to convert canvas to blob"))
            return
          }

          const reader = new FileReader()
          reader.onload = () => {
            resolve(reader.result as string)
          }
          reader.onerror = () => {
            reject(new Error("Failed to read blob as data URL"))
          }
          reader.readAsDataURL(blob)
        },
        "image/png",
        1.0,
      )
    } catch (error) {
      reject(error)
    }
  })
}

// Generate optimized barcode for PDF documents
export async function generatePDFBarcode(
  text: string,
  scannerType: "handheld" | "fixed" | "mobile" | "industrial" = "handheld",
): Promise<{ dataURL: string; config: BarcodeConfig; quality: any }> {
  let config: BarcodeConfig

  switch (scannerType) {
    case "handheld":
      config = {
        ...BARCODE_PRESETS.PACKAGE_TRACKING,
        width: 3,
        height: 60, // Reduced height for PDF
        quiet: 15,
      }
      break
    case "fixed":
      config = {
        ...BARCODE_PRESETS.SHIPPING_LABEL,
        width: 2,
        height: 50, // Reduced height for PDF
        quiet: 12,
      }
      break
    case "mobile":
      config = {
        ...BARCODE_PRESETS.MOBILE_SCANNER,
        width: 4,
        height: 70, // Reduced height for PDF
        quiet: 20,
      }
      break
    case "industrial":
      config = {
        ...BARCODE_PRESETS.PACKAGE_TRACKING,
        width: 4,
        height: 80, // Reduced height for PDF
        quiet: 25,
        fontSize: 12,
      }
      break
    default:
      config = BARCODE_PRESETS.PACKAGE_TRACKING
  }

  const quality = validateBarcodeQuality(text, config)
  const dataURL = await generateBarcodeAsPNG(text, config)

  return { dataURL, config, quality }
}

// Validate barcode readability
export function validateBarcodeQuality(
  text: string,
  config: BarcodeConfig,
): {
  isValid: boolean
  warnings: string[]
  recommendations: string[]
} {
  const warnings: string[] = []
  const recommendations: string[] = []

  // Check minimum bar width for scanner compatibility
  if (config.width < 1) {
    warnings.push("Bar width too narrow - may cause scanning issues")
    recommendations.push("Increase bar width to at least 1px")
  }

  // Check height for proper scanning
  if (config.height < 50) {
    warnings.push("Barcode height too short for reliable scanning")
    recommendations.push("Increase height to at least 50px")
  }

  // Check quiet zone
  if (config.quiet < 10) {
    warnings.push("Quiet zone too small - may affect scanning accuracy")
    recommendations.push("Increase quiet zone to at least 10px")
  }

  // Check contrast
  if (config.background === config.lineColor) {
    warnings.push("No contrast between background and bars")
    recommendations.push("Use high contrast colors (black bars on white background)")
  }

  // Check text length
  if (text.length > 48) {
    warnings.push("Text too long - may affect barcode density")
    recommendations.push("Consider using shorter identifiers or different barcode format")
  }

  return {
    isValid: warnings.length === 0,
    warnings,
    recommendations,
  }
}

// Generate optimized barcode for specific scanner types
export function generateOptimizedBarcode(
  text: string,
  scannerType: "handheld" | "fixed" | "mobile" | "industrial" = "handheld",
): { dataURL: string; config: BarcodeConfig; quality: any } {
  let config: BarcodeConfig

  switch (scannerType) {
    case "handheld":
      config = {
        ...BARCODE_PRESETS.PACKAGE_TRACKING,
        width: 3,
        height: 100,
        quiet: 15,
      }
      break
    case "fixed":
      config = {
        ...BARCODE_PRESETS.SHIPPING_LABEL,
        width: 2,
        height: 80,
        quiet: 12,
      }
      break
    case "mobile":
      config = {
        ...BARCODE_PRESETS.MOBILE_SCANNER,
        width: 4,
        height: 120,
        quiet: 20,
      }
      break
    case "industrial":
      config = {
        ...BARCODE_PRESETS.PACKAGE_TRACKING,
        width: 4,
        height: 150,
        quiet: 25,
        fontSize: 16,
      }
      break
    default:
      config = BARCODE_PRESETS.PACKAGE_TRACKING
  }

  const quality = validateBarcodeQuality(text, config)
  const dataURL = generateBarcodeAsDataURL(text, config)

  return { dataURL, config, quality }
}

// Test barcode generation with sample data
export function testBarcodeGeneration(): void {
  const testCases = ["ORD123456789", "PKG-2024-001", "DELIVERY-ABC123", "1234567890123"]

  testCases.forEach((text) => {
    try {
      const result = generateOptimizedBarcode(text, "handheld")
      console.log(`✓ Generated barcode for: ${text}`)
      console.log(`  Quality: ${result.quality.isValid ? "PASS" : "FAIL"}`)
      if (result.quality.warnings.length > 0) {
        console.log(`  Warnings: ${result.quality.warnings.join(", ")}`)
      }
    } catch (error) {
      console.error(`✗ Failed to generate barcode for: ${text}`, error)
    }
  })
}
