import React from 'react'
import { PageSection, Stack, StackItem, Title, TextInput, HelperText, HelperTextItem, Button } from '@patternfly/react-core'
import { useNavigate } from 'react-router-dom'
import { useAppConfig } from '../../state/config'

export function ConfigPanel() {
  const navigate = useNavigate();
  const { baseUrl, setBaseUrl } = useAppConfig()
  const [url, setUrl] = React.useState(baseUrl || '')

  // Function to setBaseURL and navigate back to the main route
  const handleSave = () => {
    setBaseUrl(url)
    navigate('/')
  }

  return (
    <PageSection variant="default">
      <Stack hasGutter>
        <StackItem>
          <Title headingLevel="h1">Configuration</Title>
          <p>
            For local development, run: <code>kubectl proxy --port=8001</code> and set the API endpoint to <code>http://localhost:8001</code>.
          </p>
        </StackItem>
        <StackItem>
          <TextInput
            value={url}
            onChange={(_, v) => setUrl(v)}
            aria-label="API endpoint"
            placeholder="http://localhost:8001"
          />
          <HelperText>
            <HelperTextItem>Base URL for Kubernetes API (proxied). Tokens are not stored.</HelperTextItem>
          </HelperText>
        </StackItem>
        <StackItem>
          <Button variant="primary" onClick={handleSave} isDisabled={!url}>Save</Button>
        </StackItem>
      </Stack>
    </PageSection>
  )
}
