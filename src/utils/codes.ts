export const generateTrackingCode = async (): Promise<string> => {
    const rngNumber = Math.floor(100000000 + Math.random() * + 900000000)

    return `BR${rngNumber}$BR}`
}