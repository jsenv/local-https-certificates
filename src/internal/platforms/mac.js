/*
 * see
 * - https://github.com/davewasmer/devcert/blob/master/src/platforms/darwin.ts
 * - https://www.unix.com/man-page/mojave/1/security/
 */

import { infoSign, okSign } from "@jsenv/https-localhost/src/internal/logs.js"

import { detectFirefox } from "./mac/mac_utils.js"
import {
  getCertificateTrustInfoFromMac,
  addCertificateInMacTrustStore,
  removeCertificateFromMacTrustStore,
} from "./mac/mac_trust_store.js"
import {
  getCertificateTrustInfoFromFirefox,
  addCertificateInFirefoxTrustStore,
  removeCertificateFromFirefoxTrustStore,
} from "./mac/firefox_trust_store.js"

export const getCertificateTrustInfo = async ({ logger, certificate, certificateCommonName }) => {
  const macTrustInfo = await getMacTrustInfo({
    logger,
    certificate,
  })

  // chrome use OS trust store
  const chromeTrustInfo = { ...macTrustInfo }

  // safari use OS trust store
  const safariTrustInfo = { ...macTrustInfo }

  const firefoxTrustInfo = await getFirefoxTrustInfo({
    logger,
    certificate,
    certificateCommonName,
  })

  return {
    mac: macTrustInfo,
    chrome: chromeTrustInfo,
    safari: safariTrustInfo,
    firefox: firefoxTrustInfo,
  }
}

export const getNewCertificateTrustInfo = () => {
  const macTrustInfo = {
    status: "not_trusted",
    reason: "tryToTrust disabled",
  }

  // chrome use OS trust store
  const chromeTrustInfo = { ...macTrustInfo }

  // safari use OS trust store
  const safariTrustInfo = { ...macTrustInfo }

  const firefoxTrustInfo = {
    status: "not_trusted",
    reason: "tryToTrust disabled",
  }

  return {
    mac: macTrustInfo,
    chrome: chromeTrustInfo,
    safari: safariTrustInfo,
    firefox: firefoxTrustInfo,
  }
}

const getMacTrustInfo = async ({ logger, certificate, certificateCommonName }) => {
  logger.info(`Check if certificate is trusted by mac OS...`)
  const macTrustInfo = await getCertificateTrustInfoFromMac({
    logger,
    certificate,
    certificateCommonName,
  })
  if (macTrustInfo.status === "trusted") {
    logger.info(`${okSign} certificate trusted by mac OS`)
  } else {
    logger.info(`${infoSign} certificate not trusted by mac OS`)
  }
  return macTrustInfo
}

const getFirefoxTrustInfo = async ({ logger, certificate, certificateCommonName }) => {
  const firefoxDetected = detectFirefox({ logger })
  if (!firefoxDetected) {
    return {
      status: "other",
      reason: "Firefox not detected",
    }
  }

  logger.info(`Check if certificate is trusted by Firefox...`)
  const firefoxTrustInfo = await getCertificateTrustInfoFromFirefox({
    logger,
    certificate,
    certificateCommonName,
  })
  if (firefoxTrustInfo.status === "trusted") {
    logger.info(`${okSign} certificate trusted by Firefox`)
  } else if (firefoxTrustInfo.status === "not_trusted") {
    logger.info(`${infoSign} certificate not trusted by Firefox`)
  } else {
    logger.info(
      `${infoSign} unable to detect if certificate is trusted by Firefox (${firefoxTrustInfo.reason})`,
    )
  }
  return firefoxTrustInfo
}

export const addCertificateToTrustStores = async ({
  logger,
  certificate,
  certificateFileUrl,
  certificateCommonName,
  NSSDynamicInstall = true,
  existingTrustInfo,
}) => {
  const macTrustInfo = await putInMacTrustStoreIfNeeded({
    logger,
    certificateFileUrl,
    existingMacTrustInfo: existingTrustInfo ? existingTrustInfo.mac : null,
  })

  // chrome use OS trust store
  const chromeTrustInfo = { ...macTrustInfo }

  // safari use OS trust store
  const safariTrustInfo = { ...macTrustInfo }

  const firefoxTrustInfo = await putInFirefoxTrustStoreIfNeeded({
    logger,
    certificate,
    certificateFileUrl,
    certificateCommonName,
    NSSDynamicInstall,
    existingFirefoxTrustInfo: existingTrustInfo ? existingTrustInfo.firefox : null,
  })

  return {
    mac: macTrustInfo,
    chrome: chromeTrustInfo,
    safari: safariTrustInfo,
    firefox: firefoxTrustInfo,
  }
}

const putInMacTrustStoreIfNeeded = async ({ logger, certificateFileUrl, existingMacTrustInfo }) => {
  if (existingMacTrustInfo && existingMacTrustInfo.status !== "not_trusted") {
    return existingMacTrustInfo
  }

  return await addCertificateInMacTrustStore({
    logger,
    certificateFileUrl,
  })
}

const putInFirefoxTrustStoreIfNeeded = async ({
  logger,
  certificate,
  certificateFileUrl,
  certificateCommonName,
  NSSDynamicInstall,
  existingFirefoxTrustInfo,
}) => {
  if (existingFirefoxTrustInfo && existingFirefoxTrustInfo.status !== "not_trusted") {
    return existingFirefoxTrustInfo
  }

  const firefoxDetected = detectFirefox({ logger })
  if (!firefoxDetected) {
    return {
      status: "other",
      reason: "Firefox not detected",
    }
  }

  return await addCertificateInFirefoxTrustStore({
    logger,
    certificate,
    certificateFileUrl,
    certificateCommonName,
    NSSDynamicInstall,
  })
}

export const removeCertificateFromTrustStores = async ({
  logger,
  certificate,
  certificateFileUrl,
  certificateCommonName,
}) => {
  await removeCertificateFromMacTrustStore({
    logger,
    certificate,
    certificateFileUrl,
    certificateCommonName,
  })

  // no need for chrome and safari, they are handled by mac keychain

  await removeCertificateFromFirefoxTrustStore({
    logger,
    certificate,
    certificateFileUrl,
    certificateCommonName,
  })
}
