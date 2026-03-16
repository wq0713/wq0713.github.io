##比较两个曲线(Curve)的距离
###比较两个多段线的距离
调用方法:
Curve cur1 = entI as Curve;

double jd = Math.Round(cur1.GetDistanceAtParameter(cur1.EndParam) / 100, 2);//这里计算一下,免得线太长计算太多也没必要

Line ldis = GetMinLine(entI as Polyline, entJ as Polyline, jd);

###方法

```csharp
   public static Line GetMinLine(Curve curve1, Curve curve2, double jd)
        {
            List<Curve> lstCurves = GetCurves(curve1, jd);
            double minVal = double.MaxValue;
            Point3d ptMin1 = Point3d.Origin;
            Point3d ptMin2 = Point3d.Origin;
            foreach (var c in lstCurves)
            {
                Point3d pt1 = c.StartPoint;
                Point3d pt2 = c.EndPoint;
                var pt11 = curve2.GetClosestPointTo(pt1, false);
                var pt22 = curve2.GetClosestPointTo(pt2, false);
                var l1 = pt11.DistanceTo(pt1);
                var l2 = pt22.DistanceTo(pt2);
                if (l1 < minVal)
                {
                    minVal = l1;
                    ptMin1 = pt11;
                    ptMin2 = pt1;
                }
                if (l2 < minVal)
                {
                    minVal = l2;
                    ptMin1 = pt22;
                    ptMin2 = pt2;
                }
            }
            //ed.WriteMessage("\n 最短距离:" + minVal + "\n");
            return new Line(ptMin1, ptMin2);
        }


private static List<Curve> GetCurves(Curve curve, double jd)
{
List<Curve> lstCurves = new List<Curve>();
double totalLength = curve.GetDistanceAtParameter(curve.EndParam);
if (totalLength < jd)
{
lstCurves.Add(curve);
return lstCurves;
}
double addLength = 0;
Point3dCollection pt3dCol = new Point3dCollection();
while (addLength < totalLength)
{
pt3dCol.Add(curve.GetPointAtDist(addLength));
addLength += jd;
}
if (addLength != totalLength)
pt3dCol.Add(curve.GetPointAtDist(totalLength));
DBObjectCollection dbObjColl = curve.GetSplitCurves(pt3dCol);
foreach (var item in dbObjColl)
{
lstCurves.Add((Curve)item);
}
dbObjColl.Dispose();
return lstCurves;
}
```
