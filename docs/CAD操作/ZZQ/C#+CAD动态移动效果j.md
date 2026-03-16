c#+CAD动态移动效果

```csharp
public class MoveRotateScaleJig : DrawJig
{
public static List<Entity> entities = new List<Entity>();
private int step = 1;
private int totalStepNum = 3;

public Point3d moveStartPnt;
public static Point3d moveEndPnt;
public Double rotateAngle;
public Double scaleFactor;

public MoveRotateScaleJig(Point3d basePnt)
{
moveStartPnt = basePnt;
moveEndPnt = moveStartPnt;
rotateAngle = 0;
scaleFactor = 1;
}

public Matrix3d Transformation
{
get
{
return Matrix3d.Scaling(scaleFactor, moveEndPnt).
PostMultiplyBy(Matrix3d.Rotation(rotateAngle, Vector3d.ZAxis, moveEndPnt)).
PostMultiplyBy(Matrix3d.Displacement(moveStartPnt.GetVectorTo(moveEndPnt)));
}
}

public void AddEntity(Entity ent)
{
entities.Add(ent);
}

public void TransformEntities()
{
Matrix3d mat = Transformation;
foreach (Entity ent in entities)
{
ent.TransformBy(mat);
}
}

protected override bool WorldDraw(Autodesk.AutoCAD.GraphicsInterface.WorldDraw draw)
{
Matrix3d mat = Transformation;

WorldGeometry geo = draw.Geometry;
if (geo != null)
{
geo.PushModelTransform(mat);

foreach (Entity ent in entities)
{
geo.Draw(ent);
}

geo.PopModelTransform();
}

return true;
}

protected override SamplerStatus Sampler(JigPrompts prompts)
{
switch (step)
{
case 1:
JigPromptPointOptions prOptions1 = new JigPromptPointOptions("\n目标点:");
prOptions1.UserInputControls = UserInputControls.GovernedByOrthoMode
| UserInputControls.GovernedByUCSDetect;
PromptPointResult prResult1 = prompts.AcquirePoint(prOptions1);
if (prResult1.Status != PromptStatus.OK)
return SamplerStatus.Cancel;

if (prResult1.Value.Equals(moveEndPnt))
{
return SamplerStatus.NoChange;
}
else
{
moveEndPnt = prResult1.Value;
return SamplerStatus.OK;
}

case 2:
JigPromptAngleOptions prOptions2 = new JigPromptAngleOptions("\nRotate:");
prOptions2.UseBasePoint = true;
prOptions2.BasePoint = moveEndPnt;
prOptions2.UserInputControls = UserInputControls.GovernedByOrthoMode
| UserInputControls.GovernedByUCSDetect;
PromptDoubleResult prResult2 = prompts.AcquireAngle(prOptions2);
if (prResult2.Status != PromptStatus.OK)
return SamplerStatus.Cancel;

if (prResult2.Value.Equals(rotateAngle))
{
return SamplerStatus.NoChange;
}
else
{
rotateAngle = prResult2.Value;
return SamplerStatus.OK;
}

case 3:
JigPromptDistanceOptions prOptions3 = new JigPromptDistanceOptions("\nScale:");
prOptions3.UseBasePoint = true;
prOptions3.BasePoint = moveEndPnt;
prOptions3.UserInputControls = UserInputControls.GovernedByOrthoMode
| UserInputControls.GovernedByUCSDetect;
PromptDoubleResult prResult3 = prompts.AcquireDistance(prOptions3);
if (prResult3.Status != PromptStatus.OK)
return SamplerStatus.Cancel;

if (prResult3.Value.Equals(scaleFactor))
{
return SamplerStatus.NoChange;
}
else
{
scaleFactor = prResult3.Value;
return SamplerStatus.OK;
}

default:
break;
}

return SamplerStatus.OK;
}

public static bool Jig()
{
try
{
Document doc = Application.DocumentManager.MdiActiveDocument;
Database db = doc.Database;

// 选择对象
PromptSelectionResult selRes = doc.Editor.GetSelection();
if (selRes.Status != PromptStatus.OK)
return false;

// 指定起点
PromptPointResult ppr = doc.Editor.GetPoint("\nStart point:");
if (ppr.Status != PromptStatus.OK)
return false;
Point3d basePnt = ppr.Value;
basePnt = basePnt.TransformBy(doc.Editor.CurrentUserCoordinateSystem);

// Draw Jig
MoveRotateScaleJig jig = new MoveRotateScaleJig(basePnt);
using (Transaction tr = db.TransactionManager.StartTransaction())
{
foreach (ObjectId id in selRes.Value.GetObjectIds())
{
Entity ent = (Entity)tr.GetObject(id, OpenMode.ForWrite);
jig.AddEntity(ent);
}

// Draw Jig 交互
PromptResult pr;
do
{
pr = doc.Editor.Drag(jig);
if (pr.Status == PromptStatus.Keyword)
{
// Keyword handling code
}
else
{
jig.step++;
}
}
while (pr.Status == PromptStatus.OK
&& jig.step <= jig.totalStepNum);

// 结果
if (pr.Status == PromptStatus.OK &&
jig.step == jig.totalStepNum + 1)
{
jig.TransformEntities();
}
else
{
return false;
}


tr.Commit();
return true;
}
}
catch
{
return false;
}
}

public static bool JigMove()
{
try
{
Document doc = Application.DocumentManager.MdiActiveDocument;
Database db = doc.Database;

//// 选择对象
//PromptSelectionResult selRes = doc.Editor.GetSelection();
//if (selRes.Status != PromptStatus.OK)
//    return false;

// 指定起点
PromptPointResult ppr = doc.Editor.GetPoint("\n指定起点:");
if (ppr.Status != PromptStatus.OK)
return false;
Point3d basePnt = ppr.Value;
basePnt = basePnt.TransformBy(doc.Editor.CurrentUserCoordinateSystem);

// Draw Jig
MoveRotateScaleJig jig = new MoveRotateScaleJig(basePnt);
using (Transaction tr = db.TransactionManager.StartTransaction())
{
//foreach (ObjectId id in selRes.Value.GetObjectIds())
//{
//    Entity ent = (Entity)tr.GetObject(id, OpenMode.ForWrite);
//}

// Draw Jig 交互
PromptResult pr;
do
{
pr = doc.Editor.Drag(jig);
if (pr.Status == PromptStatus.Keyword)
{
// Keyword handling code
}
else
{
for (int i = 0; i < entities.Count;i++ )
{
Entity ent = tr.GetObject(entities[i].ObjectId, OpenMode.ForWrite) as Entity;
AcEdPublicDll.CAcadEntity.Move(ent, basePnt, moveEndPnt);
ent.Dispose();
}
}
}
while (pr.Status != PromptStatus.OK);
tr.Commit();
return true;
}
}
catch
{
return false;
}
}
}
```
