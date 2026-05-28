import React from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton, Box, List, ListItem, ListItemText, Button, useMediaQuery, useTheme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { GroupContext } from '../GroupContext';
import { computeIssuesNoEstimate, computeIssuesWithEstimate } from '../utils/issueUtils';
import Label from './Label';
import IssueDetailModal from './IssueDetailModal';

interface ProblemsModalProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
}

export default function ProblemsModal({ open, onClose, groupId }: ProblemsModalProps) {
  const { timelogs, labels } = React.useContext(GroupContext);
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [selectedIssueUrl, setSelectedIssueUrl] = React.useState<string | null>(null);
  const [selectedIssueTitle, setSelectedIssueTitle] = React.useState<string>("");

  // Compute issue lists using shared utils
  const issuesNoEstimate = computeIssuesNoEstimate(timelogs);
  const issuesWithEstimate = computeIssuesWithEstimate(timelogs);

  const hasNoEstimate = Object.keys(issuesNoEstimate).length > 0;
  const hasOther = Object.values(issuesWithEstimate).some((it) => it.category === 'Other') ||
    Object.values(issuesNoEstimate).some((it) => it.category === 'Other');

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} maxWidth="md" fullWidth>
      <DialogTitle sx={{ m: 0, p: 2 }}>
        Problems Board
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {hasNoEstimate && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ mb: 1, fontWeight: 'bold' }}>Issues without Time Estimate</Box>
            <List>
              {Object.entries(issuesNoEstimate).map(([url, data]) => (
                <ListItem
                  key={url}
                  onClick={() => {
                    setSelectedIssueUrl(url);
                    setSelectedIssueTitle(data.issueTitle);
                  }}
                  sx={{ alignItems: 'flex-start', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <ListItemText primary={data.issueTitle} secondary={data.category} />
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', mt: 0.5 }}>
                    {(data.issueLabels || []).map((label) => (
                      <Label
                        key={label}
                        name={label}
                        color={
                          Object.values(labels || {})
                            .flat()
                            .find((l) => l.id === label)?.color || '#428fdc'
                        }
                      />
                    ))}
                  </Box>
                </ListItem>
              ))}
            </List>
          </Box>
        )}
        {hasOther && (
          <Box>
            <Box sx={{ mb: 1, fontWeight: 'bold' }}>Uncategorized Issues</Box>
            <List>
              {Object.entries(issuesWithEstimate)
                .filter(([_, data]) => data.category === 'Other')
                .map(([url, data]) => (
                  <ListItem
                    key={url}
                    onClick={() => {
                      setSelectedIssueUrl(url);
                      setSelectedIssueTitle(data.issueTitle);
                    }}
                    sx={{ alignItems: 'flex-start', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                  >
                    <ListItemText primary={data.issueTitle} />
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', mt: 0.5 }}>
                      {(data.issueLabels || []).map((label) => (
                        <Label
                          key={label}
                          name={label}
                          color={
                            Object.values(labels || {})
                              .flat()
                              .find((l) => l.id === label)?.color || '#428fdc'
                          }
                        />
                      ))}
                    </Box>
                  </ListItem>
                ))}
              {Object.entries(issuesNoEstimate)
                .filter(([_, data]) => data.category === 'Other')
                .map(([url, data]) => (
                  <ListItem
                    key={url}
                    onClick={() => {
                      setSelectedIssueUrl(url);
                      setSelectedIssueTitle(data.issueTitle);
                    }}
                    sx={{ alignItems: 'flex-start', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                  >
                    <ListItemText primary={data.issueTitle} />
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', mt: 0.5 }}>
                      {(data.issueLabels || []).map((label) => (
                        <Label
                          key={label}
                          name={label}
                          color={
                            Object.values(labels || {})
                              .flat()
                              .find((l) => l.id === label)?.color || '#428fdc'
                          }
                        />
                      ))}
                    </Box>
                  </ListItem>
                ))}
            </List>
          </Box>
        )}
      </DialogContent>
      {selectedIssueUrl && (
        <IssueDetailModal
          open={!!selectedIssueUrl}
          onClose={() => setSelectedIssueUrl(null)}
          issueUrl={selectedIssueUrl}
          issueTitle={selectedIssueTitle}
        />
      )}
    </Dialog>
  );
}
