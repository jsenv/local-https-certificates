/*
 * see https://github.com/davewasmer/devcert/blob/master/src/platforms/linux.ts
 */

import { existsSync } from "node:fs"
import { createDetailedMessage } from "@jsenv/logger"
import { readFile, urlToFileSystemPath } from "@jsenv/filesystem"

import {
  commandSign,
  okSign,
  infoSign,
  failureSign,
} from "@jsenv/https-local/src/internal/logs.js"
import { exec } from "@jsenv/https-local/src/internal/exec.js"
import {
  VERB_CHECK_TRUST,
  VERB_ADD_TRUST,
  VERB_REMOVE_TRUST,
} from "../trust_query.js"

const REASON_NEW_AND_TRY_TO_TRUST_DISABLED =
  "certificate is new and tryToTrust is disabled"
const REASON_NOT_FOUND_IN_LINUX = `not found in linux store`
const REASON_OUTDATED_IN_LINUX = "certificate in linux store is outdated"
const REASON_FOUND_IN_LINUX = "found in linux store"
const REASON_ADD_COMMAND_FAILED = "command to add certificate to linux failed"
const REASON_ADD_COMMAND_COMPLETED =
  "command to add certificate to linux completed"
const REASON_REMOVE_COMMAND_FAILED =
  "command to remove certificate from linux failed"
const REASON_REMOVE_COMMAND_COMPLETED =
  "command to remove certificate from linux completed"

const LINUX_CERTIFICATE_AUTHORITIES_DIRECTORY_PATH = `/usr/local/share/ca-certificates/`
const JSENV_AUTHORITY_ROOT_CERTIFICATE_PATH = `${LINUX_CERTIFICATE_AUTHORITIES_DIRECTORY_PATH}https_local_root_certificate.crt`

export const executeTrustQueryOnLinux = async ({
  logger,
  // certificateCommonName,
  certificateFileUrl,
  certificateIsNew,
  certificate,
  verb,
}) => {
  if (verb === VERB_CHECK_TRUST && certificateIsNew) {
    logger.info(`${infoSign} You should add certificate to linux`)
    return {
      status: "not_trusted",
      reason: REASON_NEW_AND_TRY_TO_TRUST_DISABLED,
    }
  }

  logger.info(`Check if certificate is in linux...`)
  logger.debug(
    `Searching certificate file at ${JSENV_AUTHORITY_ROOT_CERTIFICATE_PATH}...`,
  )
  const certificateFilePath = urlToFileSystemPath(certificateFileUrl)
  const certificateStatus = await getCertificateStatus({ certificate })

  if (certificateStatus === "missing" || certificateStatus === "outdated") {
    if (certificateStatus === "missing") {
      logger.info(`${infoSign} certificate not in linux`)
    } else {
      logger.info(`${infoSign} certificate in linux is outdated`)
    }
    if (verb === VERB_CHECK_TRUST || verb === VERB_REMOVE_TRUST) {
      return {
        status: "not_trusted",
        reason:
          certificateStatus === "missing"
            ? REASON_NOT_FOUND_IN_LINUX
            : REASON_OUTDATED_IN_LINUX,
      }
    }

    const copyCertificateCommand = `sudo /bin/cp -f "${certificateFilePath}" ${JSENV_AUTHORITY_ROOT_CERTIFICATE_PATH}`
    const updateCertificateCommand = `sudo update-ca-certificates`
    logger.info(`Adding certificate to linux...`)
    try {
      logger.info(`${commandSign} ${copyCertificateCommand}`)
      await exec(copyCertificateCommand)
      logger.info(`${commandSign} ${updateCertificateCommand}`)
      await exec(updateCertificateCommand)
      logger.info(`${okSign} certificate added to linux`)
      return {
        status: "trusted",
        reason: REASON_ADD_COMMAND_COMPLETED,
      }
    } catch (e) {
      console.error(e)
      logger.error(
        createDetailedMessage(
          `${failureSign} failed to add certificate to linux`,
          {
            "certificate file": certificateFilePath,
          },
        ),
      )
      return {
        status: "not_trusted",
        reason: REASON_ADD_COMMAND_FAILED,
      }
    }
  }

  logger.info(`${okSign} certificate found in linux`)
  if (verb === VERB_CHECK_TRUST || verb === VERB_ADD_TRUST) {
    return {
      status: "trusted",
      reason: REASON_FOUND_IN_LINUX,
    }
  }

  logger.info(`Removing certificate from linux...`)
  const removeCertificateCommand = `sudo rm ${JSENV_AUTHORITY_ROOT_CERTIFICATE_PATH}`
  const updateCertificateCommand = `sudo update-ca-certificates`
  try {
    logger.info(`${commandSign} ${removeCertificateCommand}`)
    await exec(removeCertificateCommand)
    logger.info(`${commandSign} ${updateCertificateCommand}`)
    await exec(updateCertificateCommand)
    logger.info(`${okSign} certificate removed from linux`)
    return {
      status: "not_trusted",
      reason: REASON_REMOVE_COMMAND_COMPLETED,
    }
  } catch (e) {
    logger.error(
      createDetailedMessage(
        `${failureSign} failed to remove certificate from linux`,
        {
          "error stack": e.stack,
          "certificate file": JSENV_AUTHORITY_ROOT_CERTIFICATE_PATH,
        },
      ),
    )
    return {
      status: "unknown",
      reason: REASON_REMOVE_COMMAND_FAILED,
    }
  }
}

const getCertificateStatus = async ({ certificate }) => {
  const certificateInStore = existsSync(JSENV_AUTHORITY_ROOT_CERTIFICATE_PATH)
  if (!certificateInStore) {
    return "missing"
  }
  const certificateInLinuxStore = await readFile(
    JSENV_AUTHORITY_ROOT_CERTIFICATE_PATH,
    { as: "string" },
  )
  if (certificateInLinuxStore !== certificate) {
    return "outdated"
  }
  return "found"
}
