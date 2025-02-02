function updateData () {
  /* Fetch project cards from GitHub project and insert into Google Sheet. */
  const scriptProperties = PropertiesService.getScriptProperties()

  const spreadsheet = SpreadsheetApp.getActive()
  const sheetName = scriptProperties.getProperty('SHEET_NAME')
  const sheet = spreadsheet.getSheetByName(sheetName)
  const githubApiUrl = 'https://api.github.com/graphql'
  const githubAccessToken = scriptProperties.getProperty('GITHUB_ACCESS_TOKEN')
  const githubOrg = scriptProperties.getProperty('GITHUB_ORG')
  const githubProjectNumber = scriptProperties.getProperty('GITHUB_PROJECT_NUMBER')
  const headers = {
    Authorization: 'Bearer ' + githubAccessToken
  }

  const query = {
    query: `
      query{
        organization(login: "${githubOrg}") {
          projectV2(number: ${githubProjectNumber}){
            fields(first: 20, orderBy: {field: NAME, direction: ASC}) {
              nodes {
                ... on ProjectV2FieldCommon {
                  id
                  name
                }
              }
            }
            items(first: 100, orderBy: {field: POSITION, direction: ASC}) {
              nodes{
                id
                type
                content {
                  ... on Issue {
                    url
                  }
                  ... on PullRequest {
                    url
                  }
                }
                fieldValues(first: 20, orderBy: {field: POSITION, direction: ASC}) {
                  nodes{
                    ... on ProjectV2ItemFieldTextValue {
                      text
                      field {
                        ... on ProjectV2FieldCommon {
                          name
                        }
                      }
                    }
                    ... on ProjectV2ItemFieldNumberValue {
                      number
                      field {
                        ... on ProjectV2FieldCommon {
                          name
                        }
                      }
                    }
                    ... on ProjectV2ItemFieldDateValue {
                      date
                      field {
                        ... on ProjectV2FieldCommon {
                          name
                        }
                      }
                    }
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field {
                        ... on ProjectV2FieldCommon {
                          name
                        }
                      }
                    }
                    ... on ProjectV2ItemFieldIterationValue {
                      title
                      field {
                        ... on ProjectV2FieldCommon {
                          name
                        }
                      }
                    }
                    ... on ProjectV2ItemFieldMilestoneValue {
                      milestone {
                        id
                        title
                      }
                      field {
                        ... on ProjectV2FieldCommon {
                          id
                          dataType
                          name
                        }
                      }
                    }
                    ... on ProjectV2ItemFieldUserValue {
                      users(first: 20) {
                        nodes {
                          login
                        }
                      }
                      field {
                        ... on ProjectV2FieldCommon {
                          name
                        }
                      }
                    }
                    ... on ProjectV2ItemFieldLabelValue {
                      labels(first: 20) {
                        nodes {
                          name
                        }
                      }
                      field {
                        ... on ProjectV2FieldCommon {
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }`
  }

  // Query the API
  console.log(query)
  const response = UrlFetchApp.fetch(githubApiUrl, {
    headers,
    method: 'post',
    payload: JSON.stringify(query)
  })
  const body = response.getContentText()
  console.log(body)

  /**
   * Parsed data from the API response.
   */
  const data = JSON.parse(body).data

  /**
   * List of headers for the sheet.
   */
  const sheetHeaders = ['URL']

  for (const field of data.organization.projectV2.fields.nodes) {
    sheetHeaders.push(field.name)
  }

  /**
   * Data formatted into rows to be appended to the sheet.
   */
  const rows = []

  rows.push(sheetHeaders);

  // Format data to be Google Sheets friendly
  for (const item of data.organization.projectV2.items.nodes) {
    const values = []
    
    for (const i in sheetHeaders) {
      values[i] = ''
    }

    values[0] = item.content.url

    for (const value of item.fieldValues.nodes) {
      if (value.field !== undefined) {
        const i = sheetHeaders.indexOf(value.field.name)
        if (value.text !== undefined) { values[i] = value.text }
        if (value.number !== undefined) { values[i] = value.number }
        if (value.date !== undefined) { values[i] = value.date }
        if (value.name !== undefined) { values[i] = value.name }
        if (value.title !== undefined) { values[i] = value.title }
        if (value.milestone !== undefined) {
          values[i] = value.milestone.title
        }
        if (value.users !== undefined) {
          values[i] = value.users.nodes.map(user => user.login).join(', ')
        }
        if (value.labels !== undefined) {
          values[i] = value.labels.nodes.map(label => label.name).join(', ')
        }
      }
    }

    rows.push(values);
  }

  // Write data to the sheet
  sheet.clear()

  sheet.getRange(
        sheet.getLastRow() + 1,
        1,
        rows.length,
        rows[0].length
      )
      .setValues(rows);
}

function createTimeDrivenTriggers () {
  /* Trigger every ten minutes. */
  ScriptApp.newTrigger('updateData')
    .timeBased()
    .everyMinutes(10)
    .create()
}

function onOpen (e) {
  /* Add a custom menu to the spreadsheet. */
  SpreadsheetApp.getUi()
    .createMenu('GitHub')
    .addItem('Pull Tech Roadmap', 'updateData')
    .addToUi()
}

function onInstall (e) {
  onOpen(e)
}
