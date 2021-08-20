/*
 * - ensure logs (info, not debug ones)
 * - certificate must not be trusted
 */

import { assert } from "@jsenv/assert"
import { urlToFileSystemPath } from "@jsenv/filesystem"

import { requestCertificateForLocalhost } from "@jsenv/https-localhost"
import { getCertificateAuthorityFileUrls } from "@jsenv/https-localhost/src/internal/certificate_authority_file_urls.js"
import {
  TEST_PARAMS,
  resetAllCertificateFiles,
  createLoggerForTest,
  startServerForTest,
  launchChromium,
  launchFirefox,
  launchWebkit,
  requestServerUsingBrowser,
} from "@jsenv/https-localhost/test/test_helpers.mjs"

const serverCertificateFileUrl = new URL("./certificate/server.crt", import.meta.url)
const rootCertificateSymlinkUrl = new URL(
  "./certificate/jsenv_certificate_authority.crt",
  import.meta.url,
)
const loggerForTest = createLoggerForTest({
  // forwardToConsole: true,
})
const firstCallParams = {
  ...TEST_PARAMS,
  logger: loggerForTest,
  serverCertificateFileUrl,
}

await resetAllCertificateFiles()
const { serverCertificate, serverPrivateKey } = await requestCertificateForLocalhost(
  firstCallParams,
)
const serverOrigin = await startServerForTest({
  serverCertificate,
  serverPrivateKey,
})

{
  const rootCertificateFilePath = urlToFileSystemPath(
    getCertificateAuthorityFileUrls().rootCertificateFileUrl,
  )
  const mustBeTrustedMessage = {
    win32: `
Root certificate must be added to windows trust store
--- root certificate file ---
${urlToFileSystemPath(rootCertificateSymlinkUrl)}
--- suggested command ---
> certutil -addstore -user root "${rootCertificateFilePath}"
`,
    darwin: `
Root certificate must be added to macOS keychain
--- root certificate file ---
${urlToFileSystemPath(rootCertificateSymlinkUrl)}
--- suggested documentation ---
https://support.apple.com/guide/keychain-access/add-certificates-to-a-keychain-kyca2431/mac
--- suggested command ---
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain -p ssl -p basic "${rootCertificateFilePath}"
`,
    linux: `
Root certificate must be added to linux trust store
--- root certificate file ---
${urlToFileSystemPath(rootCertificateSymlinkUrl)}
--- suggested command ---
> sudo cp "${rootCertificateFilePath}" /usr/local/share/ca-certificates/jsenv_certificate_authority.crt
> sudo update-ca-certificates
`,
  }[process.platform]
  const actual = loggerForTest.getLogs({ info: true, warn: true, error: true })
  const expected = {
    infos: [
      `Generating root certificate files`,
      `Generating server certificate files`,
      mustBeTrustedMessage,
      `
Firefox detected, root certificate needs to be trusted in Firefox
--- root certificate file ---
${urlToFileSystemPath(rootCertificateSymlinkUrl)}
--- suggested documentation ---
https://wiki.mozilla.org/PSM:Changing_Trust_Settings
`,
    ],
    warns: [],
    errors: [],
  }
  assert({ actual, expected })
}

{
  const browser = await launchChromium()
  try {
    await requestServerUsingBrowser({
      serverOrigin,
      browser,
    })
    throw new Error("should throw")
  } catch (e) {
    const actual = e.errorText
    const expected = "net::ERR_CERT_AUTHORITY_INVALID"
    assert({ actual, expected })
  } finally {
    browser.close()
  }
}

{
  const browser = await launchFirefox()
  try {
    await requestServerUsingBrowser({
      serverOrigin,
      browser,
    })
    throw new Error("should throw")
  } catch (e) {
    const actual = e.errorText
    const expected = "SEC_ERROR_UNKNOWN_ISSUER"
    assert({ actual, expected })
  } finally {
    browser.close()
  }
}

{
  const browser = await launchWebkit()
  try {
    await requestServerUsingBrowser({
      serverOrigin,
      browser,
    })
    throw new Error("should throw")
  } catch (e) {
    const actual = e.errorText
    const expected =
      "The certificate for this server is invalid. You might be connecting to a server that is pretending to be “localhost” which could put your confidential information at risk."
    assert({ actual, expected })
  } finally {
    browser.close()
  }
}
