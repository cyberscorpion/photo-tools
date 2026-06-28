import { useState, useEffect } from 'react'

// Curated fallback list of fonts commonly installed on Windows/Mac/Linux
const FALLBACK_FONTS = [
  // Sans-serif
  'Arial', 'Arial Black', 'Arial Narrow', 'Calibri', 'Candara', 'Comic Sans MS',
  'Franklin Gothic Medium', 'Gill Sans', 'Impact', 'Lucida Sans', 'Segoe UI',
  'Tahoma', 'Trebuchet MS', 'Verdana',
  // Serif
  'Book Antiqua', 'Cambria', 'Century', 'Century Gothic', 'Garamond', 'Georgia',
  'Palatino Linotype', 'Times New Roman',
  // Mono
  'Consolas', 'Courier', 'Courier New', 'Lucida Console', 'Monaco',
  // Mac extras
  'Helvetica', 'Helvetica Neue', 'Optima', 'Futura', 'Baskerville', 'Gill Sans',
  // System
  'system-ui',
].sort()

export function useLocalFonts() {
  const [fonts, setFonts] = useState<string[]>(FALLBACK_FONTS)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        // Modern Local Font Access API (Chrome 103+, requires permission)
        if ('queryLocalFonts' in window) {
          const localFonts = await (window as any).queryLocalFonts()
          const families: string[] = [...new Set<string>(
            localFonts.map((f: any) => f.family as string)
          )].sort()
          if (families.length > 0) {
            setFonts(families)
          }
        }
      } catch {
        // Permission denied or API not available — fallback list is already set
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return { fonts, loading }
}
