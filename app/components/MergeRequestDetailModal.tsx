"use client";
import React, { useContext } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  Box,
  Divider,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
  Avatar,
  useMediaQuery,
  useTheme,
  Link,
} from "@mui/material";
import { Close, OpenInNew, CallSplit, CheckCircle, Chat } from "@mui/icons-material";
import { GroupContext } from "../GroupContext";
import { UserAvatar } from "./UserAvatar";

type MergeRequestDetailModalProps = {
  open: boolean;
  onClose: () => void;
  mrUrl: string;
};

const parseMarkdownToReact = (text: string, baseOrigin: string): React.ReactNode => {
  if (!text) return null;

  let processed = text;
  processed = processed.replace(/<ul>/g, "").replace(/<\/ul>/g, "");
  processed = processed.replace(/<li>/g, "\n- ").replace(/<\/li>/g, "");

  const lines = processed.split("\n");
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) return <Box key={lineIdx} sx={{ height: 8 }} />;

        const isListItem = trimmed.startsWith("- ") || trimmed.startsWith("* ");
        const content = isListItem ? trimmed.slice(2) : line;

        const parseInline = (str: string): React.ReactNode[] => {
          const result: React.ReactNode[] = [];
          let current = str;
          let keyIdx = 0;

          while (current.length > 0) {
            const imgMatch = current.match(/!\[([^\]]*)\]\(([^)]+)\)(?:\{width=(\d+)\s+height=(\d+)\})?/);
            const customImgMatch = current.match(/!([^ ]+\.(?:png|jpg|jpeg|gif|svg))(?:\{width=(\d+)\s+height=(\d+)\})?/);
            const linkMatch = current.match(/\[([^\]]+)\]\(([^)]+)\)/);
            const boldMatch = current.match(/\*\*([^*]+)\*\*/);
            const codeMatch = current.match(/`([^`]+)`/);
            const italicMatch = current.match(/\*([^*]+)\*/);

            let earliest: { index: number; length: number; node: React.ReactNode } | null = null;

            if (imgMatch && imgMatch.index !== undefined) {
              const src = imgMatch[2].startsWith("/") ? `${baseOrigin}${imgMatch[2]}` : imgMatch[2];
              const alt = imgMatch[1] || "image";
              const width = imgMatch[3] ? parseInt(imgMatch[3], 10) : undefined;
              const height = imgMatch[4] ? parseInt(imgMatch[4], 10) : undefined;

              earliest = {
                index: imgMatch.index,
                length: imgMatch[0].length,
                node: (
                  <Box
                    key={`img-${keyIdx++}`}
                    component="img"
                    src={src}
                    alt={alt}
                    sx={{
                      maxWidth: "100%",
                      height: height ? `${height}px` : "auto",
                      width: width ? `${width}px` : "auto",
                      borderRadius: "4px",
                      display: "block",
                      my: 1,
                    }}
                  />
                ),
              };
            }

            if (customImgMatch && customImgMatch.index !== undefined && (earliest === null || customImgMatch.index < earliest.index)) {
              const src = customImgMatch[1].startsWith("/") ? `${baseOrigin}${customImgMatch[1]}` : customImgMatch[1];
              const alt = "image";
              const width = customImgMatch[2] ? parseInt(customImgMatch[2], 10) : undefined;
              const height = customImgMatch[3] ? parseInt(customImgMatch[3], 10) : undefined;

              earliest = {
                index: customImgMatch.index,
                length: customImgMatch[0].length,
                node: (
                  <Box
                    key={`img-${keyIdx++}`}
                    component="img"
                    src={src}
                    alt={alt}
                    sx={{
                      maxWidth: "100%",
                      height: height ? `${height}px` : "auto",
                      width: width ? `${width}px` : "auto",
                      borderRadius: "4px",
                      display: "block",
                      my: 1,
                    }}
                  />
                ),
              };
            }

            if (linkMatch && linkMatch.index !== undefined && (earliest === null || linkMatch.index < earliest.index)) {
              const href = linkMatch[2].startsWith("/") ? `${baseOrigin}${linkMatch[2]}` : linkMatch[2];
              earliest = {
                index: linkMatch.index,
                length: linkMatch[0].length,
                node: (
                  <Link
                    key={`link-${keyIdx++}`}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ color: "primary.main", textDecoration: "underline", wordBreak: "break-all" }}
                  >
                    {linkMatch[1]}
                  </Link>
                ),
              };
            }

            if (boldMatch && boldMatch.index !== undefined && (earliest === null || boldMatch.index < earliest.index)) {
              earliest = {
                index: boldMatch.index,
                length: boldMatch[0].length,
                node: (
                  <strong key={`bold-${keyIdx++}`} style={{ fontWeight: 700 }}>
                    {boldMatch[1]}
                  </strong>
                ),
              };
            }

            if (codeMatch && codeMatch.index !== undefined && (earliest === null || codeMatch.index < earliest.index)) {
              earliest = {
                index: codeMatch.index,
                length: codeMatch[0].length,
                node: (
                  <code
                    key={`code-${keyIdx++}`}
                    style={{
                      fontFamily: "monospace",
                      backgroundColor: "rgba(0, 0, 0, 0.06)",
                      padding: "2px 4px",
                      borderRadius: "4px",
                      fontSize: "0.85em",
                    }}
                  >
                    {codeMatch[1]}
                  </code>
                ),
              };
            }

            if (italicMatch && italicMatch.index !== undefined && (earliest === null || italicMatch.index < earliest.index)) {
              earliest = {
                index: italicMatch.index,
                length: italicMatch[0].length,
                node: (
                  <em key={`em-${keyIdx++}`} style={{ fontStyle: "italic" }}>
                    {italicMatch[1]}
                  </em>
                ),
              };
            }

            if (earliest) {
              if (earliest.index > 0) {
                result.push(current.substring(0, earliest.index));
              }
              result.push(earliest.node);
              current = current.substring(earliest.index + earliest.length);
            } else {
              result.push(current);
              break;
            }
          }

          return result;
        };

        const parsedContent = parseInline(content);

        if (isListItem) {
          return (
            <Box key={lineIdx} sx={{ display: "flex", alignItems: "flex-start", gap: 1, pl: 2 }}>
              <Typography component="span" sx={{ userSelect: "none" }}>•</Typography>
              <Typography variant="body2" component="span" sx={{ color: "text.primary" }}>
                {parsedContent}
              </Typography>
            </Box>
          );
        }

        return (
          <Typography key={lineIdx} variant="body2" sx={{ color: "text.primary" }}>
            {parsedContent}
          </Typography>
        );
      })}
    </Box>
  );
};

export default function MergeRequestDetailModal({
  open,
  onClose,
  mrUrl,
}: MergeRequestDetailModalProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const { mergeRequests, members } = useContext(GroupContext);

  const mr = React.useMemo(() => {
    return mergeRequests.find((m) => m.webUrl === mrUrl);
  }, [mergeRequests, mrUrl]);

  if (!mr) return null;

  const author = members.find((m) => m.id === mr.username);

  const gitlabOrigin = React.useMemo(() => {
    try {
      return new URL(mr.webUrl).origin;
    } catch {
      return "";
    }
  }, [mr.webUrl]);

  // Status Chip helper
  const getStatusChip = (state: string) => {
    let color: "success" | "info" | "error" | "default" = "default";
    const stateLower = state.toLowerCase();
    if (stateLower === "opened") color = "info";
    else if (stateLower === "merged") color = "success";
    else if (stateLower === "closed") color = "error";

    return (
      <Chip
        label={state}
        size="small"
        color={color}
        variant="outlined"
        sx={{ textTransform: "uppercase", fontSize: "0.65rem", fontWeight: 700 }}
      />
    );
  };

  const isProtected = (branch: string) => {
    if (mr.protectedBranches && mr.protectedBranches.length > 0) {
      return mr.protectedBranches.includes(branch);
    }
    const protectedNames = ["main", "master", "develop", "developer", "production"];
    const b = branch.toLowerCase();
    return protectedNames.includes(b) || b.startsWith("release");
  };

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Merge Request Details
          </Typography>
          {getStatusChip(mr.state)}
          {mr.additions !== null && mr.additions !== undefined && mr.deletions !== null && mr.deletions !== undefined && (
            <Box sx={{ display: "flex", gap: 1, ml: 1, fontSize: "0.85rem", fontWeight: 600 }}>
              <span style={{ color: "#2da44e" }}>+{mr.additions}</span>
              <span style={{ color: "#cf222e" }}>-{mr.deletions}</span>
            </Box>
          )}
        </Box>
        <Box>
          <IconButton
            component="a"
            href={mr.webUrl}
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            sx={{ mr: 1 }}
          >
            <OpenInNew fontSize="small" />
          </IconButton>
          <IconButton onClick={onClose} size="small">
            <Close fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 650, color: "text.primary" }}>
          {mr.title}
        </Typography>

        {/* Author Section */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
          {author ? (
            <UserAvatar member={author} size="medium" showTooltip={false} />
          ) : (
            <Avatar sx={{ width: 32, height: 32, fontSize: "0.9rem" }}>
              {mr.username.charAt(0).toUpperCase()}
            </Avatar>
          )}
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {author ? author.name : mr.username}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Created on {new Date(mr.createdAt).toLocaleString()}
            </Typography>
          </Box>
        </Box>

        {/* Description Section */}
        {mr.description && (
          <Box sx={{ mb: 3, p: 2, bgcolor: "action.hover", borderRadius: 1.5, border: "1px solid var(--border-color)" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: "text.secondary" }}>
              Description
            </Typography>
            <Box sx={{ color: "text.primary" }}>
              {parseMarkdownToReact(mr.description, gitlabOrigin)}
            </Box>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Branch Flow */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
            <CallSplit fontSize="small" color="action" />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Branching Flow
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Chip label={mr.sourceBranch} size="small" variant="outlined" />
            <Typography variant="body2" color="text.secondary">➔</Typography>
            <Chip
              label={mr.targetBranch}
              size="small"
              color={isProtected(mr.targetBranch) ? "warning" : "default"}
              sx={{ fontWeight: isProtected(mr.targetBranch) ? 600 : 400 }}
            />
            {isProtected(mr.targetBranch) && (
              <Typography variant="caption" color="warning.main" sx={{ fontStyle: "italic", ml: 1 }}>
                (Protected Branch)
              </Typography>
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Approvals */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
            <CheckCircle fontSize="small" color="action" />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Approvals ({mr.approvedBy.length})
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {mr.approvedBy.map((username) => {
              const member = members.find((m) => m.id === username);
              return (
                <Chip
                  key={username}
                  avatar={
                    member ? (
                      <Avatar src={member.avatarUrl || undefined} alt={member.name} />
                    ) : (
                      <Avatar>{username.charAt(0).toUpperCase()}</Avatar>
                    )
                  }
                  label={member ? member.name : username}
                  variant="outlined"
                  size="small"
                />
              );
            })}
            {mr.approvedBy.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                No approvals yet
              </Typography>
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Discussion Timeline Info */}
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
            <Chat fontSize="small" color="action" />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Discussion Activity
            </Typography>
          </Box>
          <List disablePadding>
            {(mr.discussions || []).map((disc) => {
              const member = members.find((m) => m.id === disc.author.username);
              
              if (disc.system) {
                return (
                  <ListItem key={disc.id} sx={{ py: 0.5, px: 0, opacity: 0.85 }}>
                    <ListItemText
                      secondary={
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.5 }}>
                            <Typography variant="caption" color="text.secondary" component="span" sx={{ fontWeight: 700 }}>
                              System:
                            </Typography>
                            <Typography variant="caption" color="text.secondary" component="span">
                              • {new Date(disc.createdAt).toLocaleString()}
                            </Typography>
                          </Box>
                          <Box sx={{ pl: 1 }}>
                            {parseMarkdownToReact(disc.body, gitlabOrigin)}
                          </Box>
                        </Box>
                      }
                      secondaryTypographyProps={{ component: "div" }}
                    />
                  </ListItem>
                );
              }

              return (
                <ListItem key={disc.id} alignItems="flex-start" sx={{ py: 1, px: 0 }}>
                  <Box sx={{ mr: 1.5, mt: 0.5 }}>
                    {member ? (
                      <UserAvatar member={member} size="small" showTooltip={true} />
                    ) : (
                      <Avatar src={disc.author.avatarUrl || undefined} sx={{ width: 24, height: 24, fontSize: "0.75rem" }}>
                        {disc.author.username.charAt(0).toUpperCase()}
                      </Avatar>
                    )}
                  </Box>
                  <ListItemText
                    primary={
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {disc.author.name || disc.author.username}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(disc.createdAt).toLocaleString()}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        {parseMarkdownToReact(disc.body, gitlabOrigin)}
                      </Box>
                    }
                    secondaryTypographyProps={{ component: "div" }}
                  />
                </ListItem>
              );
            })}
            {(!mr.discussions || mr.discussions.length === 0) && (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                No comments or actions yet
              </Typography>
            )}
          </List>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
