# Keyboard shortcuts

| Shortcut                         | Action                                                    |
| -------------------------------- | --------------------------------------------------------- |
| `V`                              | Select / marquee tool                                     |
| `H`                              | Pan tool                                                  |
| `W`                              | Draw continuous walls                                     |
| `D`                              | Place a door                                              |
| `O`                              | Place a window                                            |
| `M`                              | Measure distance                                          |
| `Space` + drag                   | Temporarily pan the canvas without changing tools         |
| Middle-mouse drag                | Pan continuously while Select is active                   |
| Arrow keys                       | Pan the viewport while Select is active                   |
| `W` / `A` / `S` / `D`            | Pan the viewport while Select is active                   |
| `Shift` + Arrow/WASD             | Pan the viewport with a larger step                       |
| Mouse wheel                      | Zoom around the pointer                                   |
| Shift + click                    | Add or remove an item from the selection                  |
| `Enter` while drawing walls      | End the current wall chain and keep the Wall tool active  |
| Double-click while drawing walls | End the current wall chain and keep the Wall tool active  |
| `Ctrl+Z`                         | Undo                                                      |
| `Ctrl+Y`                         | Redo                                                      |
| `Ctrl+Shift+Z`                   | Redo                                                      |
| `Ctrl+C`                         | Copy selection                                            |
| `Ctrl+V`                         | Paste copied objects                                      |
| `Ctrl+D`                         | Duplicate selection                                       |
| `Ctrl+S`                         | Save immediately                                          |
| `Delete` / `Backspace`           | Delete unlocked selection                                 |
| `/`                              | Focus Asset Search                                        |
| `Escape`                         | Cancel the current drawing operation and return to Select |

## Direct pointer editing in Select mode

- Drag a placed object to move it in room coordinates.
- Select a wall, then drag the wall body to translate the complete segment.
- Drag either selected-wall endpoint handle to reshape the wall while keeping coincident neighboring endpoints joined.
- Hosted doors and windows follow a translated host wall; a wall edit that would make the wall shorter than its opening is rejected.

Primary toolbar controls and collapsed-panel rails are keyboard reachable and show visible focus outlines. Shortcuts do not fire while typing in inputs, textareas, selects, or other editable controls.
